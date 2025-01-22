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

export class RoomService {
  private crosswordService: CrosswordService;
  private eloService: EloService;
  private ormConnection: DataSource;

  constructor(ormConnection: DataSource) {
    this.ormConnection = ormConnection;
    this.crosswordService = new CrosswordService(ormConnection);
    this.eloService = new EloService(
      ormConnection.getRepository(User),
      ormConnection.getRepository(Room),
    );
  }

  async getRoomById(roomId: number): Promise<Room> {
    return this.ormConnection
      .getRepository(Room)
      .findOne({ where: { id: roomId } });
  }

  async getRoomsByUserId(userId: number): Promise<Room[]> {
    return this.ormConnection
      .getRepository(Room)
      .find({ where: { players: { id: userId } } });
  }

  async joinRoom(
    user: User,
    difficulty: string,
    type: "1v1" | "2v2" | "free4all" = "1v1",
  ): Promise<Room> {
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

    // If room is full based on game type, change status to playing
    const maxPlayers = config.game.maxPlayers[room.type];
    if (room.players.length >= maxPlayers) {
      room.status = "playing";
      room.last_activity_at = new Date();
      // Remove timeout job since the game is starting
      await gameTimeoutQueue.remove(`room-timeout-${room.id}`);

      // Log timestamps for debugging
      console.log(`Setting initial last_activity_at for room ${room.id}:`, {
        timestamp: room.last_activity_at.toISOString(),
        unixTimestamp: room.last_activity_at.getTime(),
        currentTime: new Date().toISOString(),
      });

      // Start inactivity check
      fastify.log.info(`Adding inactivity job for room: ${room.id}`);
      await gameInactivityQueue.add(
        "game-inactivity",
        {
          roomId: room.id,
          lastActivityTimestamp: room.last_activity_at.getTime(),
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
          params: { roomId: room.id }
        }
      });
    }

    await this.ormConnection.getRepository(Room).save(room);
  }

  async createRoom(
    userId: number,
    difficulty: string,
    type: "1v1" | "2v2" | "free4all" = "1v1",
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

    const savedRoom = await this.ormConnection.getRepository(Room).save(room);

    // Add timeout job
    fastify.log.info(`Adding timeout job for room: ${savedRoom.id}`);
    await gameTimeoutQueue.add(
      `game-timeout`,
      { roomId: savedRoom.id },
      {
        delay: config.game.timeout.pending,
        jobId: `game-timeout`,
      },
    );
    fastify.log.info(`Added timeout job for room: ${savedRoom.id}`);

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
    type: "1v1" | "2v2" | "free4all",
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

  private async onGameEnd(room: Room, forfeitedBy?: number): Promise<void> {
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

    // Update win streaks and winner status
    for (const stats of allGameStats) {
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

    // Create or update game stats for all players if they don't exist
    const gameStatsRepo = this.ormConnection.getRepository(GameStats);
    for (const player of room.players) {
      let gameStats = await gameStatsRepo.findOne({
        where: { userId: player.id, roomId },
      });

      if (!gameStats) {
        gameStats = new GameStats();
        gameStats.user = player;
        gameStats.room = room;
        gameStats.userId = player.id;
        gameStats.roomId = roomId;
        gameStats.eloAtGame = player.eloRating;
        gameStats.correctGuesses = 0;
        gameStats.incorrectGuesses = 0;
        gameStats.correctGuessDetails = [];
        await gameStatsRepo.save(gameStats);
      }
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
    roomId: number,
    userId: number,
    x: number,
    y: number,
    guess: string,
  ): Promise<Room> {
    // Start a transaction to ensure data consistency
    const queryRunner = this.ormConnection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        // Get room with pessimistic lock
        const room = await queryRunner.manager
            .getRepository(Room)
            .createQueryBuilder("room")
            .setLock("pessimistic_write")
            .where("room.id = :roomId", { roomId })
            .getOne();

        if (!room) {
            await queryRunner.rollbackTransaction();
            throw new NotFoundError("Room not found");
        }

        // Check if letter is already found at this position
        const letterIndex = x * room.crossword.col_size + y;
        if (room.found_letters[letterIndex] !== "*") {
            await queryRunner.rollbackTransaction();
            return room;
        }

        const isCorrect = await this.crosswordService.checkGuess(
            room,
            { x, y },
            guess,
        );

        room.markModified();

        // Get or create game stats for this user and room with locking
        let gameStats = await queryRunner.manager
            .getRepository(GameStats)
            .createQueryBuilder("stats")
            .setLock("pessimistic_write")
            .where("stats.userId = :userId", { userId })
            .andWhere("stats.roomId = :roomId", { roomId })
            .getOne();

        if (!gameStats) {
            const user = await queryRunner.manager
                .getRepository(User)
                .findOneBy({ id: userId });

            if (!user) {
                await queryRunner.rollbackTransaction();
                throw new NotFoundError("User not found");
            }

            gameStats = new GameStats();
            gameStats.user = user;
            gameStats.room = room;
            gameStats.userId = userId;
            gameStats.roomId = roomId;
            gameStats.eloAtGame = user.eloRating;
            gameStats.correctGuesses = 0;
            gameStats.incorrectGuesses = 0;
            gameStats.correctGuessDetails = [];
        }

        // Update stats based on guess result
        if (isCorrect) {
            // Update last activity timestamp
            room.last_activity_at = new Date();

            gameStats.correctGuesses++;
            gameStats.correctGuessDetails = [
                ...(gameStats.correctGuessDetails || []),
                {
                    row: x,
                    col: y,
                    letter: guess,
                    timestamp: new Date(),
                },
            ];

            // Update room state
            room.found_letters[x * room.crossword.col_size + y] = guess;
            room.scores[userId] = (room.scores[userId] || 0) +
                config.game.points.correct;
            room.markModified();
        } else {
            gameStats.incorrectGuesses++;
            room.scores[userId] = (room.scores[userId] || 0) +
                config.game.points.incorrect;
            room.markModified();
        }

        // Save game stats within transaction
        await queryRunner.manager.save(GameStats, gameStats);

        // Check if game is won
        if (this.isGameFinished(room)) {
            await this.onGameEnd(room);
        } else {
            // Save room if game is not finished
            await queryRunner.manager.save(Room, room);
        }

        // Commit the transaction
        await queryRunner.commitTransaction();
        return room;
    } catch (error) {
        // Rollback transaction on error
        await queryRunner.rollbackTransaction();
        throw error;
    } finally {
        // Release the queryRunner
        await queryRunner.release();
    }
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
        params: { roomId: room.id }
      }
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
          .select("r.id")
          .from(Room, "r")
          .innerJoin("r.players", "p")
          .where("p.id = :userId")
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
