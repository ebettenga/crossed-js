import { And, DataSource, In, LessThan, Not } from "typeorm";
import type { JobType } from "bullmq";
import { JoinMethod, Room } from "../entities/Room";
import { User } from "../entities/User";
import { CrosswordService } from "./CrosswordService";
import { EloService } from "./EloService";
import { config } from "../config/config";
import { fastify } from "../fastify";
import { GameStats } from "../entities/GameStats";
import { BadRequestError, ForbiddenError, NotFoundError } from "../errors/api";
import { gameAutoRevealQueue, gameTimeoutQueue } from "../jobs/queues";
import { v4 as uuidv4 } from "uuid";
import { EntityManager } from "typeorm";
import { CachedGameInfo, RedisService } from "./RedisService";
import { TimeTrialLeaderboardEntry } from "../entities/TimeTrialLeaderboardEntry";

export class RoomService {
  private crosswordService: CrosswordService;
  private eloService: EloService;
  private ormConnection: DataSource;
  private redisService: RedisService;

  constructor(ormConnection: DataSource) {
    this.ormConnection = ormConnection;
    this.crosswordService = new CrosswordService(ormConnection);
    this.eloService = new EloService(
      ormConnection.getRepository(User),
      ormConnection.getRepository(Room),
      ormConnection.getRepository(GameStats),
    );
    this.redisService = new RedisService();
  }

  async close(): Promise<void> {
    await this.redisService.close();
  }

  private async ensureGameStatsEntry(
    room: Room,
    user: User,
  ): Promise<GameStats> {
    const gameStatsRepo = this.ormConnection.getRepository(GameStats);

    let stats = await gameStatsRepo.findOne({
      where: { roomId: room.id, userId: user.id },
    });

    if (!stats) {
      stats = gameStatsRepo.create({
        user,
        room,
        userId: user.id,
        roomId: room.id,
        eloAtGame: user.eloRating,
        correctGuesses: 0,
        incorrectGuesses: 0,
        correctGuessDetails: [],
        isWinner: false,
        winStreak: 0,
      });

      stats = await gameStatsRepo.save(stats);
    }

    return stats;
  }

  async getRoomById(roomId: number): Promise<Room> {
    const results = await this.ormConnection
      .getRepository(Room)
      .findOne({ where: { id: roomId } });

    if (results) {
      let cachedGameInfo = await this.redisService.getGame(
        results.id.toString(),
      );
      if (cachedGameInfo) {
        results.found_letters = cachedGameInfo.foundLetters;
        results.scores = cachedGameInfo.scores;
      }
    }
    return results;
  }

  async getRoomsByUserId(userId: number): Promise<Room[]> {
    return this.ormConnection
      .getRepository(Room)
      .find({ where: { players: { id: userId } } });
  }

  async joinRoom(
    user: User,
    difficulty: string,
    type: "1v1" | "2v2" | "free4all" | "time_trial" = "1v1",
  ): Promise<Room> {
    // For time_trial, create a new room immediately since it's single player
    if (type === "time_trial") {
      return await this.createRoom(user.id, difficulty, type);
    }

    let room = await this.findEmptyRoomByDifficulty(difficulty, type, user);

    if (room) {
      fastify.log.info(`Found room with id: ${room.id}`);
      await this.joinExistingRoom(room, user.id);
      return room;
    } else {
      return await this.createRoom(user.id, difficulty, type);
    }
  }

  async joinExistingRoom(room: Room, userId: number): Promise<void> {
    fastify.log.info(`Joining room with id: ${room.id} by user: ${userId}`);
    const player = await this.ormConnection
      .getRepository(User)
      .findOneBy({ id: userId });

    if (!player) throw new Error("User not found");

    const isAlreadyPlayer = room.players.some(
      (existing) => existing.id === player.id,
    );

    if (!isAlreadyPlayer) {
      room.players.push(player);
      room.markModified();
    }
    if (room.scores[player.id] === undefined) {
      room.scores[player.id] = 0;
      room.markModified();
    }

    // Ensure newly joined player's active sockets receive future room events
    fastify.io
      .in(`user_${player.id}`)
      .socketsJoin(room.id.toString());

    await this.ensureGameStatsEntry(room, player);

    const crosswordReset = await this.syncCrosswordForPlayers(room);

    let cachedGameInfo = await this.redisService.getGame(room.id.toString());
    if (cachedGameInfo && !crosswordReset) {
      if (!cachedGameInfo.userGuessCounts[player.id]) {
        cachedGameInfo.userGuessCounts[player.id] = {
          correct: 0,
          incorrect: 0,
        };
      }
      if (!cachedGameInfo.correctGuessDetails) {
        cachedGameInfo.correctGuessDetails = {};
      }
      if (!cachedGameInfo.correctGuessDetails[player.id]) {
        cachedGameInfo.correctGuessDetails[player.id] = [];
      }
      if (cachedGameInfo.scores[player.id] === undefined) {
        cachedGameInfo.scores[player.id] = 0;
      }
      await this.redisService.cacheGame(room.id.toString(), cachedGameInfo);
    } else if (!cachedGameInfo) {
      cachedGameInfo = room.createRoomCache();
      await this.redisService.cacheGame(room.id.toString(), cachedGameInfo);
    }

    // If room is full based on game type, change status to playing
    const maxPlayers = config.game.maxPlayers[room.type];
    if (room.players.length >= maxPlayers) {
      room.status = "playing";
      // Remove timeout job since the game is starting
      await gameTimeoutQueue.remove(`room-timeout-${room.id}`);

      // Kick off auto-reveal pressure system
      fastify.log.info(`Adding auto-reveal job for room: ${room.id}`);
      await gameAutoRevealQueue.add(
        "game-auto-reveal",
        {
          roomId: room.id,
          lastActivityTimestamp: new Date().getTime(),
        },
        {
          jobId: `game-auto-reveal-${room.id}-${uuidv4()}`,
          delay: config.game.timeout.autoReveal.initial,
        },
      );

      // Emit game_started event through fastify.io
      fastify.io.to(room.id.toString()).emit("game_started", {
        message: "All players have joined! Game is starting.",
        room: room.toJSON(),
        navigate: {
          screen: "game",
          params: { roomId: room.id },
        },
      });
    }

    await this.ormConnection.getRepository(Room).save(room);

    if (room.type === "time_trial") {
      await this.updateTimeTrialLeaderboard(room);
    }
  }

  async createRoom(
    userId: number,
    difficulty: string,
    type: "1v1" | "2v2" | "free4all" | "time_trial" = "1v1",
  ): Promise<Room> {
    const player = await this.ormConnection
      .getRepository(User)
      .findOneBy({ id: userId });

    if (!player) throw new Error("User not found");

    const allowedPacks = await this.crosswordService.getSharedCrosswordPacks([
      player.id,
    ]);
    const crossword = await this.crosswordService.getCrosswordByDifficulty(
      difficulty,
      { packs: allowedPacks },
    );

    if (!crossword) {
      throw new NotFoundError(
        "No crossword available for the requested difficulty",
      );
    }

    const room = new Room();
    room.players = [player];
    room.crossword = crossword;
    room.difficulty = difficulty;
    room.type = type;
    room.scores = { [player.id]: 0 };
    room.join = JoinMethod.RANDOM;

    room.found_letters = this.maskCrosswordGrid(crossword.grid);

    // For time trials, start the game immediately
    if (type === "time_trial") {
      room.status = "playing";
      room.last_activity_at = new Date();
    }

    const savedRoom = await this.ormConnection.getRepository(Room).save(room);

    // Ensure the creating player's sockets are subscribed to the room channel
    fastify.io
      .in(`user_${player.id}`)
      .socketsJoin(savedRoom.id.toString());

    const stats = await this.ensureGameStatsEntry(savedRoom, player);
    savedRoom.stats = [stats];

    // Only add timeout job for non-time trial games
    if (type !== "time_trial") {
      fastify.log.info(`Adding timeout job for room: ${savedRoom.id}`);
      const timeoutJobId = `room-timeout-${savedRoom.id}`;
      await gameTimeoutQueue.remove(timeoutJobId);
      await gameTimeoutQueue.add(
        "game-timeout",
        {
          roomId: savedRoom.id,
          reason: "pending_timeout",
          message: "We couldn't find another player in time.",
        },
        {
          delay: config.game.timeout.pending,
          jobId: timeoutJobId,
        },
      );
      fastify.log.info(`Added timeout job for room: ${savedRoom.id}`);
    } else {
      // For time trials, start auto-reveal cycle immediately
      fastify.log.info(
        `Adding auto-reveal job for time trial room: ${savedRoom.id}`,
      );
      await gameAutoRevealQueue.add(
        "game-auto-reveal",
        {
          roomId: savedRoom.id,
          lastActivityTimestamp: room.last_activity_at.getTime(),
        },
        {
          jobId: `game-auto-reveal-${savedRoom.id}-${uuidv4()}`,
          delay: config.game.timeout.autoReveal.initial,
        },
      );
    }

    return savedRoom;
  }

  async cancelRoom(roomId: number, requestingUserId?: number): Promise<Room> {
    const room = await this.getRoomById(roomId);
    if (!room) throw new NotFoundError("Room not found");

    if (room.status !== "pending") {
      throw new BadRequestError("Only pending games can be cancelled");
    }

    if (!["1v1", "free4all"].includes(room.type)) {
      throw new BadRequestError(
        "Only 1v1 or free4all games can be cancelled while pending",
      );
    }

    if (requestingUserId !== undefined) {
      const isParticipant = room.players.some((player) =>
        player.id === requestingUserId
      );

      if (!isParticipant) {
        throw new ForbiddenError("You are not a participant in this game");
      }
    }

    room.status = "cancelled";
    room.markModified();
    await this.ormConnection.getRepository(Room).save(room);
    return room;
  }

  private async findEmptyRoomByDifficulty(
    difficulty: string,
    type: "1v1" | "2v2" | "free4all" | "time_trial",
    user: User,
  ): Promise<Room> {
    let userRoomIds: number[] = [];
    // First get all rooms this user is in
    if (!user.roles.includes("admin")) {
      const userRooms = await this.ormConnection
        .getRepository(Room)
        .createQueryBuilder("room")
        .select("room.id")
        .innerJoin("room.players", "players")
        .where("players.id = :userId", { userId: user.id })
        .getMany();
      userRoomIds = userRooms.map((room) => room.id);
    }

    return this.ormConnection.getRepository(Room).findOne({
      where: {
        difficulty,
        status: "pending",
        type,
        id: userRoomIds.length > 0 ? Not(In(userRoomIds)) : undefined,
        players: LessThan(config.game.maxPlayers[type]),
      },
      order: { created_at: "ASC" },
    });
  }

  async getActiveRoomsForUser(userId: number): Promise<Room[]> {
    return this.ormConnection
      .getRepository(Room)
      .createQueryBuilder("room")
      .leftJoinAndSelect("room.players", "players")
      .leftJoinAndSelect("room.crossword", "crossword")
      .where("players.id = :userId", { userId })
      .andWhere("room.status = :status", { status: "playing" })
      .getMany();
  }

  async onGameEnd(room: Room, forfeitedBy?: number): Promise<void> {
    room.status = "finished";
    room.completed_at = new Date();

    // If game was forfeited, adjust scores (but skip penalties for time trials)
    if (forfeitedBy !== undefined && room.type !== "time_trial") {
      const minScore = Math.min(...Object.values(room.scores)) +
        config.game.points.forfeit;
      room.scores[forfeitedBy] = minScore;
    }

    // Find player with highest score
    const highestScore = Math.max(...Object.values(room.scores));
    const winnerIds = Object.entries(room.scores)
      .filter(([userId, score]) => score === highestScore)
      .map(([userId]) => parseInt(userId));

    // Get all game stats for players in this room
    const gameStatsRepo = this.ormConnection.getRepository(GameStats);
    const allGameStats = await gameStatsRepo.find({
      where: {
        roomId: room.id,
      },
    });

    const cachedGameInfo = await this.redisService.getGame(room.id.toString());

    // Log for debugging
    if (!cachedGameInfo) {
      fastify.log.warn(
        `No cached game info found for room ${room.id} during onGameEnd`,
      );
    }

    console.log("cached game info", cachedGameInfo);
    // Update win streaks and winner from cached game
    for (const player of room.players) {
      const playerStats = allGameStats.find((stat) =>
        stat.userId === player.id
      ) || await this.ensureGameStatsEntry(room, player);

      const guessCounts = cachedGameInfo?.userGuessCounts?.[player.id] || {
        correct: 0,
        incorrect: 0,
      };

      playerStats.correctGuesses = guessCounts.correct;
      playerStats.incorrectGuesses = guessCounts.incorrect;

      const guessDetails = cachedGameInfo?.correctGuessDetails?.[player.id] ||
        [];
      playerStats.correctGuessDetails = guessDetails.map((detail) => ({
        ...detail,
        timestamp: new Date(detail.timestamp),
      }));

      // If game was forfeited, non-forfeiting players are winners
      const isWinner = forfeitedBy !== undefined
        ? playerStats.userId !== forfeitedBy
        : winnerIds.includes(playerStats.userId);

      if (isWinner) {
        // Get the player's stats from their last completed game
        const previousStats = await gameStatsRepo
          .createQueryBuilder("stats")
          .innerJoinAndSelect("stats.room", "room")
          .where("stats.userId = :userId", { userId: playerStats.userId })
          .andWhere("stats.roomId != :roomId", { roomId: room.id })
          .andWhere("room.status = :status", { status: "finished" })
          .orderBy("stats.createdAt", "DESC")
          .take(1)
          .getOne();

        playerStats.isWinner = true;
        playerStats.winStreak = (previousStats?.winStreak || 0) + 1;
      } else {
        playerStats.isWinner = false;
        playerStats.winStreak = 0; // Reset win streak for losers
      }

      console.log(`saving gameStats. user: ${playerStats.userId}`, playerStats);

      await gameStatsRepo.save(playerStats);
    }

    // Update ELO ratings for all players
    try {
      const newRatings = await this.eloService.updateEloRatings(room);

      // Emit rating changes to all players
      for (const [playerId, newRating] of newRatings.entries()) {
        const oldRating = room.players.find((p) =>
          p.id === playerId
        )?.eloRating || 0;
        const ratingChange = newRating - oldRating;

        fastify.io.to(playerId.toString()).emit("rating_change", {
          oldRating,
          newRating,
          change: ratingChange,
        });
      }
    } catch (error) {
      fastify.log.error({ err: error }, "Failed to update ELO ratings");
    }

    await this.ormConnection.getRepository(Room).save(room);

    if (room.type === "time_trial") {
      await this.updateTimeTrialLeaderboard(room);
    }

    // If game was forfeited, emit forfeit event
    if (forfeitedBy !== undefined) {
      fastify.io.to(room.id.toString()).emit("game_forfeited", {
        message: "A player has forfeited the game",
        forfeitedBy,
        room: room.toJSON(),
      });
    }
  }

  async forfeitGame(roomId: number, userId: number): Promise<Room> {
    const room = await this.getRoomById(roomId);

    fastify.log.info(`Forfeiting game with id: ${roomId} by user: ${userId}`);

    if (!room) {
      throw new Error("Room not found");
    }

    if (!room.players.some((player) => player.id === userId)) {
      throw new Error("User is not a participant in this room");
    }

    const hasRecordedGuess = await this.hasRecordedCorrectGuess(room);
    const isUnplayed = !hasRecordedGuess;

    if (room.type === "free4all" && isUnplayed) {
      return await this.handleFreeForAllForfeit(room, userId);
    }

    const shouldDeleteRoom = isUnplayed &&
      (room.type === "time_trial" ||
        room.type === "1v1" ||
        room.status !== "playing");

    if (shouldDeleteRoom) {
      fastify.log.info(
        { roomId: room.id },
        "Deleting unplayed room after forfeit",
      );
      await this.cleanupUnplayedRoom(room);
      room.status = "cancelled";
      room.completed_at = null;
      return room;
    }

    // Ensure game stats exist for all players before ending the game
    for (const player of room.players) {
      await this.ensureGameStatsEntry(room, player);
    }

    room.markModified();
    await this.onGameEnd(room, userId);
    return room;
  }

  async getRoomsByUserAndStatus(
    userId: number,
    status?: "playing" | "pending" | "finished" | "cancelled",
  ): Promise<Room[]> {
    const query = this.ormConnection
      .getRepository(Room)
      .createQueryBuilder("room")
      .leftJoinAndSelect("room.players", "players")
      .leftJoinAndSelect("room.crossword", "crossword")
      .where("players.id = :userId", { userId });

    if (status) {
      query.andWhere("room.status = :status", { status });
    }

    return query.getMany();
  }

  private async syncTimeTrialLeaderboardForCrossword(
    crosswordId: number,
  ): Promise<void> {
    const rooms = await this.ormConnection.getRepository(Room).find({
      where: {
        type: "time_trial",
        status: "finished",
        crossword: { id: crosswordId },
      },
      relations: ["players", "crossword"],
    });

    if (!rooms.length) {
      return;
    }

    await Promise.all(
      rooms.map((finishedRoom) =>
        this.updateTimeTrialLeaderboard(finishedRoom)
      ),
    );
  }

  private async updateTimeTrialLeaderboard(room: Room): Promise<void> {
    if (
      room.type !== "time_trial" ||
      !room.players ||
      room.players.length === 0
    ) {
      return;
    }

    const player = room.players[0];
    if (!player) {
      return;
    }

    const leaderboardRepo = this.ormConnection.getRepository(
      TimeTrialLeaderboardEntry,
    );
    const scoreValues = Object.values(room.scores || {});
    const score = scoreValues.length > 0 ? Math.max(...scoreValues) : 0;
    const timeTakenMs = room.completed_at && room.created_at
      ? room.completed_at.getTime() - room.created_at.getTime()
      : null;

    const existing = await leaderboardRepo.findOne({
      where: {
        crossword: { id: room.crossword.id },
        user: { id: player.id },
      },
    });

    const existingTime = existing?.timeTakenMs ?? Number.MAX_SAFE_INTEGER;
    const newTime = timeTakenMs ?? Number.MAX_SAFE_INTEGER;
    const shouldUpdate = !existing ||
      score > existing.score ||
      (score === existing.score && newTime < existingTime);

    if (!shouldUpdate) {
      return;
    }

    const entry = existing ??
      leaderboardRepo.create({
        crossword: room.crossword,
        user: player,
      });

    entry.roomId = room.id;
    entry.score = score;
    entry.timeTakenMs = timeTakenMs;
    entry.roomCompletedAt = room.completed_at ?? null;

    await leaderboardRepo.save(entry);
  }

  private isGameFinished(room: Room): boolean {
    // If room is not in playing state, it can't be won
    if (room.status !== "playing") return false;

    // Check if all letters have been found
    // found_letters is a string array where '*' represents unfound letters
    return !room.found_letters.includes("*");
  }

  private async hasRecordedCorrectGuess(room: Room): Promise<boolean> {
    const cachedGameInfo = await this.redisService.getGame(room.id.toString());

    if (cachedGameInfo?.userGuessCounts) {
      const hasCorrectGuess = Object.values(cachedGameInfo.userGuessCounts)
        .some((counts) => (counts?.correct || 0) > 0);
      if (hasCorrectGuess) {
        return true;
      }
    }

    const statsSource = room.stats && room.stats.length > 0
      ? room.stats
      : await this.ormConnection.getRepository(GameStats).find({
        where: { roomId: room.id },
        select: ["correctGuesses"],
      });

    if (statsSource?.some((stat) => stat.correctGuesses > 0)) {
      return true;
    }

    const hasFoundLetters = Array.isArray(room.found_letters) &&
      room.found_letters.some((letter) => letter && letter !== "*");
    if (hasFoundLetters) {
      return true;
    }

    const hasPositiveScore = room.scores &&
      Object.values(room.scores).some((score) => Number(score) > 0);
    if (hasPositiveScore) {
      return true;
    }

    return false;
  }

  private async emitGameCancelled(room: Room, message: string): Promise<void> {
    if (!room.players || room.players.length === 0) {
      return;
    }

    const payload = {
      message,
      roomId: room.id,
    };

    for (const player of room.players) {
      fastify.io.to(`user_${player.id}`).emit("game_cancelled", payload);
    }

    fastify.io.to(room.id.toString()).emit("game_cancelled", payload);
  }

  private async removeAutoRevealJobsForRoom(roomId: number): Promise<void> {
    try {
      const jobStates: JobType[] = ["waiting", "delayed", "paused"];
      const jobs = await gameAutoRevealQueue.getJobs(
        jobStates,
        0,
        -1,
        false,
      );

      await Promise.all(
        jobs
          .filter((job) => job?.data?.roomId === roomId)
          .map((job) => job.remove()),
      );
    } catch (error) {
      fastify.log.error(
        { err: error, roomId },
        "Failed to clear auto-reveal jobs for room",
      );
    }
  }

  private async cleanupUnplayedRoom(room: Room): Promise<void> {
    await this.emitGameCancelled(room, "Game cancelled");
    await this.removeAutoRevealJobsForRoom(room.id);
    await this.redisService.deleteKey(room.id.toString());

    await this.ormConnection.getRepository(GameStats).delete({
      roomId: room.id,
    });

    await this.ormConnection.getRepository(Room).remove(room);
  }

  private async handleFreeForAllForfeit(
    room: Room,
    forfeitingUserId: number,
  ): Promise<Room> {
    const remainingPlayers = room.players.filter((player) =>
      player.id !== forfeitingUserId
    );

    if (remainingPlayers.length === room.players.length) {
      return room;
    }

    room.players = remainingPlayers;
    delete room.scores[forfeitingUserId];
    room.markModified();
    await this.ormConnection.getRepository(Room).save(room);

    const cachedGameInfo = await this.redisService.getGame(room.id.toString());
    if (cachedGameInfo) {
      delete cachedGameInfo.scores[forfeitingUserId];
      if (cachedGameInfo.userGuessCounts) {
        delete cachedGameInfo.userGuessCounts[forfeitingUserId];
      }
      if (cachedGameInfo.correctGuessDetails) {
        delete cachedGameInfo.correctGuessDetails[forfeitingUserId];
      }
      await this.redisService.cacheGame(room.id.toString(), cachedGameInfo);
    }

    await this.ormConnection.getRepository(GameStats).delete({
      roomId: room.id,
      userId: forfeitingUserId,
    });

    if (room.players.length >= 3) {
      fastify.io.to(room.id.toString()).emit("room", room.toJSON());
      return room;
    }

    await this.cleanupUnplayedRoom(room);
    room.status = "cancelled";
    room.completed_at = null;
    return room;
  }

  async handleGuess(
    roomId: number,
    userId: number,
    x: number,
    y: number,
    guess: string,
    entityManager?: EntityManager,
  ): Promise<Room> {
    const manager = entityManager || this.ormConnection.manager;

    // Load room (players and crossword are eager on the entity)
    let room = await manager.getRepository(Room).findOne({
      where: { id: roomId },
    });
    if (!room) throw new NotFoundError("Room not found");

    // Load or initialize game cache
    let cachedGameInfo = await this.redisService.getGame(room.id.toString());
    if (!cachedGameInfo) {
      // Initialize cache from the current DB state
      cachedGameInfo = room.createRoomCache();
    }

    // Ensure user tracking structures exist
    if (!cachedGameInfo.userGuessCounts[userId]) {
      cachedGameInfo.userGuessCounts[userId] = { correct: 0, incorrect: 0 };
    }
    if (!cachedGameInfo.correctGuessDetails) {
      cachedGameInfo.correctGuessDetails = {};
    }
    if (!cachedGameInfo.correctGuessDetails[userId]) {
      cachedGameInfo.correctGuessDetails[userId] = [];
    }
    if (cachedGameInfo.scores[userId] === undefined) {
      cachedGameInfo.scores[userId] = 0;
    }

    // Compute letter index
    const letterIndex = x * room.crossword.col_size + y;
    if (cachedGameInfo.foundLetters[letterIndex] !== "*") {
      return room;
    }

    const isCorrect = await this.crosswordService.checkGuess(
      room.crossword,
      { x, y },
      guess,
    );

    // Update stats based on guess result
    if (isCorrect) {
      // Update last activity timestamp
      cachedGameInfo.lastActivityAt = Date.now();

      cachedGameInfo.userGuessCounts[userId].correct++;
      cachedGameInfo.correctGuessDetails[userId].push({
        row: x,
        col: y,
        letter: guess,
        timestamp: Date.now(),
      });

      // Update board + score
      cachedGameInfo.foundLetters[letterIndex] = guess;
      cachedGameInfo.scores[userId] = (cachedGameInfo.scores[userId] || 0) +
        config.game.points.correct;
    } else {
      cachedGameInfo.userGuessCounts[userId].incorrect++;
      cachedGameInfo.scores[userId] = (cachedGameInfo.scores[userId] || 0) +
        config.game.points.incorrect;
    }

    // Persist authoritative state to DB to avoid cache reinitialization wiping progress
    room.found_letters = cachedGameInfo.foundLetters;
    room.scores = cachedGameInfo.scores;
    if (cachedGameInfo.lastActivityAt) {
      room.last_activity_at = new Date(cachedGameInfo.lastActivityAt);
    }

    // Determine if the game is finished based on the updated state
    const finished = !cachedGameInfo.foundLetters.includes("*");

    if (finished) {
      // Mark modified so toJSON invalidates cache
      room.markModified();
      await this.onGameEnd(room);
    } else {
      // Save room if game is not finished
      await manager.getRepository(Room).save(room);
    }

    // Update cache after DB write
    await this.redisService.cacheGame(room.id.toString(), cachedGameInfo);

    // Invalidate view cache so clients receive updated view
    room.markModified();
    return room;
  }

  addCacheToRoom(room: Room, cachedGameInfo: CachedGameInfo): Room {
    room.found_letters = cachedGameInfo.foundLetters;
    room.scores = cachedGameInfo.scores;
    return room;
  }

  private maskCrosswordGrid(grid: string[] | null | undefined): string[] {
    if (!Array.isArray(grid)) {
      return [];
    }
    return grid.map((value) => value.replace(/[A-Za-z]/g, "*"));
  }

  private async syncCrosswordForPlayers(room: Room): Promise<boolean> {
    const playerIds = room.players.map((player) => player.id);
    const allowedPacks = await this.crosswordService.getSharedCrosswordPacks(
      playerIds,
    );
    const packSet = new Set(allowedPacks);
    const hasExisting = room.crossword &&
      packSet.has(room.crossword.pack || "general");

    if (hasExisting) {
      for (const id of playerIds) {
        if (room.scores[id] === undefined) {
          room.scores[id] = 0;
        }
      }
      return false;
    }

    const replacement = await this.crosswordService.getCrosswordByDifficulty(
      room.difficulty,
      { packs: allowedPacks },
    );

    if (!replacement) {
      throw new NotFoundError(
        "No crossword available for the current players and difficulty",
      );
    }

    room.crossword = replacement;
    room.found_letters = this.maskCrosswordGrid(replacement.grid);
    room.scores = playerIds.reduce<Record<number, number>>((acc, id) => {
      acc[id] = 0;
      return acc;
    }, {});
    room.markModified();

    const cache = room.createRoomCache();
    await this.redisService.cacheGame(room.id.toString(), cache);
    return true;
  }

  async getRecentGamesWithStats(
    userId: number,
    limit: number = 10,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    room: {
      id: number;
      difficulty: string;
      type: string;
      status: string;
      created_at: string;
      completed_at: string | null;
      scores: Record<string, number>;
    };
    stats: {
      correctGuesses: number;
      incorrectGuesses: number;
      isWinner: boolean;
      eloAtGame: number;
    };
  }[]> {
    const query = this.ormConnection
      .getRepository(GameStats)
      .createQueryBuilder("stats")
      .leftJoinAndSelect("stats.room", "room")
      .leftJoinAndSelect("room.crossword", "crossword")
      .where("stats.userId = :userId", { userId })
      .andWhere("room.status = :status", { status: "finished" })
      .orderBy("stats.createdAt", "DESC");

    if (startDate) {
      query.andWhere("stats.createdAt >= :startDate", { startDate });
    }

    if (endDate) {
      query.andWhere("stats.createdAt <= :endDate", { endDate });
    }

    if (limit > 0) {
      query.take(limit);
    }

    const gameStats = await query.getMany();

    return gameStats.map((stats) => ({
      room: {
        id: stats.room.id,
        difficulty: stats.room.difficulty,
        type: stats.room.type,
        status: stats.room.status,
        created_at: stats.room.created_at.toISOString(),
        completed_at: stats.room.completed_at
          ? stats.room.completed_at.toISOString()
          : null,
        scores: stats.room.scores,
      },
      stats: {
        correctGuesses: stats.correctGuesses,
        incorrectGuesses: stats.incorrectGuesses,
        isWinner: stats.isWinner,
        eloAtGame: stats.eloAtGame,
      },
    }));
  }

  async createChallengeRoom(
    challengerId: number,
    challengedId: number,
    difficulty: string,
    context?: string,
  ): Promise<Room> {
    const [challenger, challenged] = await Promise.all([
      this.ormConnection.getRepository(User).findOneBy({ id: challengerId }),
      this.ormConnection.getRepository(User).findOneBy({ id: challengedId }),
    ]);

    if (!challenger || !challenged) {
      throw new NotFoundError("User not found");
    }

    const allowedPacks = await this.crosswordService.getSharedCrosswordPacks([
      challenger.id,
      challenged.id,
    ]);
    const crossword = await this.crosswordService.getCrosswordByDifficulty(
      difficulty,
      { packs: allowedPacks },
    );

    if (!crossword) {
      throw new NotFoundError(
        "No crossword available for the requested difficulty",
      );
    }

    const room = new Room();
    room.players = [challenger, challenged];
    room.crossword = crossword;
    room.difficulty = difficulty;
    room.type = "1v1";
    room.status = "pending";
    room.scores = { [challenger.id]: 0, [challenged.id]: 0 };
    room.join = JoinMethod.CHALLENGE;

    room.found_letters = this.maskCrosswordGrid(crossword.grid);

    const savedRoom = await this.ormConnection.getRepository(Room).save(room);

    // Emit a challenge event through socket.io
    fastify.io.to(`user_${challenged.id.toString()}`).emit(
      "challenge_received",
      {
        room: savedRoom.toJSON(),
        challenger: {
          id: challenger.id,
          username: challenger.username,
        },
        context,
      },
    );

    const timeoutJobId = `room-timeout-${savedRoom.id}`;
    await gameTimeoutQueue.remove(timeoutJobId);
    await gameTimeoutQueue.add(
      "game-timeout",
      {
        roomId: savedRoom.id,
        reason: "challenge_timeout",
        message: "This challenge expired because it wasn't accepted in time.",
      },
      {
        delay: config.game.timeout.challenge,
        jobId: timeoutJobId,
      },
    );

    return savedRoom;
  }

  async acceptChallenge(roomId: number, userId: number): Promise<Room> {
    const room = await this.getRoomById(roomId);
    if (!room) throw new NotFoundError("Room not found");
    if (room.status === "finished") {
      throw new BadRequestError(
        "Cannot accept a challenge for a finished game",
      );
    }

    await this.joinExistingRoom(room, userId);

    // Emit game_started event with navigation for both players
    fastify.io.to(room.id.toString()).emit("game_started", {
      message: "Challenge accepted! Game is starting.",
      room: room.toJSON(),
      navigate: {
        screen: "game",
        params: { roomId: room.id },
      },
    });

    return room;
  }

  async rejectChallenge(roomId: number): Promise<Room> {
    const room = await this.getRoomById(roomId);
    if (!room) throw new NotFoundError("Room not found");
    if (room.status === "playing" || room.status === "finished") {
      throw new BadRequestError(
        "Cannot reject a challenge that has already started or finished",
      );
    }

    room.status = "cancelled";
    room.markModified();
    await gameTimeoutQueue.remove(`room-timeout-${room.id}`);
    await this.ormConnection.getRepository(Room).save(room);
    return room;
  }

  async getPendingChallenges(userId: number): Promise<Room[]> {
    const query = this.ormConnection
      .getRepository(Room)
      .createQueryBuilder("room")
      .innerJoinAndSelect("room.players", "players")
      .leftJoinAndSelect("room.crossword", "crossword")
      .where("room.status = :status", { status: "pending" })
      .andWhere("room.type = :type", { type: "1v1" })
      .andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select("rp.room_id")
          .from("room_players", "rp")
          .where("rp.user_id = :userId")
          .getQuery();
        return "room.id IN " + subQuery;
      })
      .setParameters({
        status: "pending",
        type: "1v1",
        userId,
      });

    return query.getMany();
  }
  async getTimeTrialLeaderboard(
    roomId: number,
    limit: number = 10,
  ): Promise<{
    topEntries: Array<{
      rank: number;
      roomId: number;
      score: number;
      user: { id: number; username: string; eloRating: number } | null;
      created_at: string;
      completed_at: string | null;
      timeTakenMs: number | null;
    }>;
    currentPlayerEntry?: {
      rank: number;
      roomId: number;
      score: number;
      user: { id: number; username: string; eloRating: number } | null;
      created_at: string;
      completed_at: string | null;
      timeTakenMs: number | null;
    };
  }> {
    const room = await this.getRoomById(roomId);
    if (!room) {
      throw new NotFoundError("Room not found");
    }

    const crosswordId = room.crossword.id;
    const currentPlayerId = room.players && room.players.length > 0
      ? room.players[0].id
      : null;

    await this.syncTimeTrialLeaderboardForCrossword(crosswordId);

    const leaderboardRepo = this.ormConnection.getRepository(
      TimeTrialLeaderboardEntry,
    );

    const entries = await leaderboardRepo
      .createQueryBuilder("entry")
      .leftJoinAndSelect("entry.user", "user")
      .where(`"entry"."crosswordId" = :crosswordId`, { crosswordId })
      .orderBy("entry.score", "DESC")
      .addOrderBy("entry.timeTakenMs", "ASC", "NULLS LAST")
      .addOrderBy("entry.updated_at", "ASC")
      .getMany();

    const rankedEntries = entries.map((entry, idx) => ({
      rank: idx + 1,
      roomId: entry.roomId,
      score: entry.score,
      user: entry.user
        ? {
          id: entry.user.id,
          username: entry.user.username,
          eloRating: entry.user.eloRating,
        }
        : null,
      created_at: entry.created_at.toISOString(),
      completed_at: entry.roomCompletedAt
        ? entry.roomCompletedAt.toISOString()
        : null,
      timeTakenMs: entry.timeTakenMs,
    }));

    // Get top N entries
    const topEntries = rankedEntries.slice(0, limit);

    // Find current player's entry if not in top N
    let currentPlayerEntry: typeof rankedEntries[0] | undefined;
    if (currentPlayerId) {
      const currentEntry = rankedEntries.find((e) =>
        e.user?.id === currentPlayerId
      );
      if (currentEntry && currentEntry.rank > limit) {
        currentPlayerEntry = currentEntry;
      }
    }

    return {
      topEntries,
      currentPlayerEntry,
    };
  }

  async getGlobalTimeTrialLeaderboard(
    limit: number = 10,
  ): Promise<
    Array<{
      rank: number;
      roomId: number;
      score: number;
      user: { id: number; username: string; eloRating: number } | null;
      created_at: string;
      completed_at: string | null;
      timeTakenMs: number | null;
    }>
  > {
    const roomRepository = this.ormConnection.getRepository(Room);

    const rooms = await roomRepository.find({
      where: {
        type: "time_trial",
        status: "finished",
      },
      order: { completed_at: "DESC" },
    });

    const entries = rooms.map((room) => {
      const scoresObj = room.scores || {};
      const scoreValues = Object.values(scoresObj);
      const score = scoreValues.length > 0 ? Math.max(...scoreValues) : 0;

      const player = room.players && room.players.length > 0
        ? room.players[0]
        : null;

      const timeTakenMs = room.completed_at && room.created_at
        ? room.completed_at.getTime() - room.created_at.getTime()
        : null;

      return {
        roomId: room.id,
        user: player
          ? {
            id: player.id,
            username: player.username,
            eloRating: player.eloRating,
          }
          : null,
        score,
        created_at: room.created_at,
        completed_at: room.completed_at,
        timeTakenMs,
      };
    });

    const bestByUser = new Map<number, typeof entries[number]>();

    for (const entry of entries) {
      if (!entry.user) continue;

      const existing = bestByUser.get(entry.user.id);
      if (!existing) {
        bestByUser.set(entry.user.id, entry);
        continue;
      }

      if (entry.score > existing.score) {
        bestByUser.set(entry.user.id, entry);
        continue;
      }

      if (
        entry.score === existing.score &&
        (entry.timeTakenMs ?? Number.MAX_SAFE_INTEGER) <
          (existing.timeTakenMs ?? Number.MAX_SAFE_INTEGER)
      ) {
        bestByUser.set(entry.user.id, entry);
      }
    }

    const rankedEntries = Array.from(bestByUser.values())
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        const aTime = a.timeTakenMs ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.timeTakenMs ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
      .slice(0, limit)
      .map((entry, index) => ({
        rank: index + 1,
        roomId: entry.roomId,
        score: entry.score,
        user: entry.user,
        created_at: entry.created_at.toISOString(),
        completed_at: entry.completed_at
          ? entry.completed_at.toISOString()
          : null,
        timeTakenMs: entry.timeTakenMs,
      }));

    return rankedEntries;
  }
}
