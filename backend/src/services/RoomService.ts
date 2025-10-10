import { And, DataSource, In, LessThan, Not } from "typeorm";
import { Room } from "../entities/Room";
import { User } from "../entities/User";
import { CrosswordService } from "./CrosswordService";
import { EloService } from "./EloService";
import { config } from "../config/config";
import { fastify } from "../fastify";
import { GameStats } from "../entities/GameStats";
import { NotFoundError } from "../errors/api";
import { gameInactivityQueue, gameTimeoutQueue } from "../jobs/queues";
import { v4 as uuidv4 } from "uuid";
import { EntityManager } from "typeorm";
import { CachedGameInfo, RedisService } from "./RedisService";

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
  å;
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

    room.players.push(player);
    room.markModified();

    // Ensure newly joined player's active sockets receive future room events
    fastify.io
      .in(`user_${player.id}`)
      .socketsJoin(room.id.toString());

    await this.ensureGameStatsEntry(room, player);

    const cachedGameInfo = await this.redisService.getGame(room.id.toString());
    if (cachedGameInfo) {
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
      this.redisService.cacheGame(room.id.toString(), cachedGameInfo);
    }

    // If room is full based on game type, change status to playing
    const maxPlayers = config.game.maxPlayers[room.type];
    if (room.players.length >= maxPlayers) {
      room.status = "playing";
      // Remove timeout job since the game is starting
      await gameTimeoutQueue.remove(`room-timeout-${room.id}`);

      // Start inactivity check
      fastify.log.info(`Adding inactivity job for room: ${room.id}`);
      await gameInactivityQueue.add(
        "game-inactivity",
        {
          roomId: room.id,
          lastActivityTimestamp: new Date().getTime(),
        },
        {
          jobId: `game-inactivity-${room.id}-${uuidv4()}`,
          delay: config.game.timeout.inactivity.initial,
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
  }

  async createRoom(
    userId: number,
    difficulty: string,
    type: "1v1" | "2v2" | "free4all" | "time_trial" = "1v1",
  ): Promise<Room> {
    const crossword = await this.crosswordService.getCrosswordByDifficulty(
      difficulty,
    );

    const player = await this.ormConnection
      .getRepository(User)
      .findOneBy({ id: userId });

    if (!player) throw new Error("User not found");

    const room = new Room();
    room.players = [player];
    room.crossword = crossword;
    room.difficulty = difficulty;
    room.type = type;
    room.scores = { [player.id]: 0 };

    room.found_letters = await this.crosswordService.createFoundLettersTemplate(
      crossword.id,
    );

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
      await gameTimeoutQueue.add(
        "game-timeout",
        { roomId: savedRoom.id },
        {
          delay: config.game.timeout.pending,
          jobId: `game-timeout`,
        },
      );
      fastify.log.info(`Added timeout job for room: ${savedRoom.id}`);
    } else {
      // For time trials, start inactivity check immediately
      fastify.log.info(
        `Adding inactivity job for time trial room: ${savedRoom.id}`,
      );
      await gameInactivityQueue.add(
        "game-inactivity",
        {
          roomId: savedRoom.id,
          lastActivityTimestamp: room.last_activity_at.getTime(),
        },
        {
          jobId: `game-inactivity-${savedRoom.id}-${uuidv4()}`,
          delay: config.game.timeout.inactivity.initial,
        },
      );
    }

    return savedRoom;
  }

  async cancelRoom(roomId: number): Promise<Room> {
    const room = await this.getRoomById(roomId);
    if (!room) throw new NotFoundError("Room not found");
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

    // If game was forfeited, adjust scores
    if (forfeitedBy !== undefined) {
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

    // Update win streaks and winner status
    for (const stats of allGameStats) {
      const guessCounts = cachedGameInfo?.userGuessCounts?.[stats.userId] || {
        correct: 0,
        incorrect: 0,
      };

      stats.correctGuesses = guessCounts.correct;
      stats.incorrectGuesses = guessCounts.incorrect;

      const guessDetails =
        cachedGameInfo?.correctGuessDetails?.[stats.userId] ||
        [];
      stats.correctGuessDetails = guessDetails.map((detail) => ({
        row: detail.row,
        col: detail.col,
        letter: detail.letter,
        timestamp: new Date(detail.timestamp),
      }));

      // If game was forfeited, non-forfeiting players are winners
      const isWinner = forfeitedBy !== undefined
        ? stats.userId !== forfeitedBy
        : winnerIds.includes(stats.userId);

      if (isWinner) {
        // Get the player's stats from their last completed game
        const previousStats = await gameStatsRepo
          .createQueryBuilder("stats")
          .innerJoinAndSelect("stats.room", "room")
          .where("stats.userId = :userId", { userId: stats.userId })
          .andWhere("stats.roomId != :roomId", { roomId: room.id })
          .andWhere("room.status = :status", { status: "finished" })
          .orderBy("stats.createdAt", "DESC")
          .take(1)
          .getOne();

        stats.isWinner = true;
        stats.winStreak = (previousStats?.winStreak || 0) + 1;
      } else {
        stats.isWinner = false;
        stats.winStreak = 0; // Reset win streak for losers
      }
      await gameStatsRepo.save(stats);
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
      fastify.log.error("Failed to update ELO ratings:", error);
    }

    await this.ormConnection.getRepository(Room).save(room);

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

  private isGameFinished(room: Room): boolean {
    // If room is not in playing state, it can't be won
    if (room.status !== "playing") return false;

    // Check if all letters have been found
    // found_letters is a string array where '*' represents unfound letters
    return !room.found_letters.includes("*");
  }

  async handleGuess(
    room: Room,
    userId: number,
    x: number,
    y: number,
    guess: string,
    entityManager?: EntityManager,
  ): Promise<Room> {
    const manager = entityManager || this.ormConnection.manager;

    let cachedGameInfo = await this.redisService.getGame(room.id.toString());
    if (!cachedGameInfo) {
      // make a cache s
      cachedGameInfo = room.createRoomCache();
    }

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

    // Check if letter is already found at this position
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

      // Update room state
      cachedGameInfo.foundLetters[x * room.crossword.col_size + y] = guess;
      cachedGameInfo.scores[userId] = (cachedGameInfo.scores[userId] || 0) +
        config.game.points.correct;
    } else {
      cachedGameInfo.userGuessCounts[userId].incorrect++;
      cachedGameInfo.scores[userId] = (cachedGameInfo.scores[userId] || 0) +
        config.game.points.incorrect;
    }

    // Check if game is won
    if (this.isGameFinished(room)) {
      room = this.addCacheToRoom(room, cachedGameInfo);
      await this.onGameEnd(room);
    } else {
      // Save room if game is not finished
      this.redisService.cacheGame(room.id.toString(), cachedGameInfo);
    }

    return this.addCacheToRoom(room, cachedGameInfo);
  }

  addCacheToRoom(room: Room, cachedGameInfo: CachedGameInfo): Room {
    room.found_letters = cachedGameInfo.foundLetters;
    room.scores = cachedGameInfo.scores;
    return room;
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
  ): Promise<Room> {
    const [challenger, challenged] = await Promise.all([
      this.ormConnection.getRepository(User).findOneBy({ id: challengerId }),
      this.ormConnection.getRepository(User).findOneBy({ id: challengedId }),
    ]);

    if (!challenger || !challenged) {
      throw new NotFoundError("User not found");
    }

    const crossword = await this.crosswordService.getCrosswordByDifficulty(
      difficulty,
    );

    const room = new Room();
    room.players = [challenger, challenged];
    room.crossword = crossword;
    room.difficulty = difficulty;
    room.type = "1v1";
    room.status = "pending";
    room.scores = { [challenger.id]: 0, [challenged.id]: 0 };

    room.found_letters = await this.crosswordService.createFoundLettersTemplate(
      crossword.id,
    );

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
      },
    );

    return savedRoom;
  }

  async acceptChallenge(roomId: number, userId: number): Promise<Room> {
    const room = await this.getRoomById(roomId);
    if (!room) throw new NotFoundError("Room not found");

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

    room.status = "cancelled";
    room.markModified();

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
}
