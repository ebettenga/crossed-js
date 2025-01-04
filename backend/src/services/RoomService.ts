import { DataSource, FindOperator, LessThan, LessThanOrEqual } from "typeorm";
import { Room } from "../entities/Room";
import { User } from "../entities/User";
import { CrosswordService } from "./CrosswordService";
import { config } from "../config/config";
import { fastify } from "../fastify";
import { GameStats } from "../entities/GameStats";

export class RoomService {
  private crosswordService: CrosswordService;
  private ormConnection: DataSource;

  constructor(ormConnection: DataSource) {
    this.ormConnection = ormConnection;
    this.crosswordService = new CrosswordService(ormConnection);
  }

  async getRoomById(roomId: number): Promise<Room> {
    return this.ormConnection
      .getRepository(Room)
      .findOne({ where: { id: roomId } });
  }

  async joinRoom(userId: number, difficulty: string, type: '1v1' | '2v2' | 'free4all' = '1v1'): Promise<Room> {
    let room = await this.findEmptyRoomByDifficulty(difficulty, type);

    if (room) {
      fastify.log.info(`Found room with id: ${room.id}`);
      await this.joinExistingRoom(room, userId);
      return room;
    } else {
      return await this.createRoom(userId, difficulty, type);
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
      room.status = 'playing';
      // Emit game_started event through fastify.io
      fastify.io.to(room.id.toString()).emit("game_started", {
        message: "All players have joined! Game is starting.",
        room: room.toView()
      });
    }

    await this.ormConnection.getRepository(Room).save(room);
  }

  async createRoom(userId: number, difficulty: string, type: '1v1' | '2v2' | 'free4all' = '1v1'): Promise<Room> {
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

    return await this.ormConnection.getRepository(Room).save(room);
  }
  
  private async findEmptyRoomByDifficulty(difficulty: string, type: '1v1' | '2v2' | 'free4all'): Promise<Room> {
    return this.ormConnection.getRepository(Room).findOne({
      where: { 
        difficulty,
        status: 'pending',
        type,
        players: LessThan(config.game.maxPlayers[type])
      },
      order: { created_at: "ASC" },
    });
  }

  async getActiveRoomsForUser(userId: number): Promise<Room[]> {
    return this.ormConnection
      .getRepository(Room)
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.players', 'players')
      .leftJoinAndSelect('room.crossword', 'crossword')
      .where('players.id = :userId', { userId })
      .andWhere('room.status = :status', { status: 'playing' })
      .getMany();
  }

  async forfeitGame(roomId: number, userId: number): Promise<Room> {
    const room = await this.getRoomById(roomId);

    fastify.log.info(`Forfeiting game with id: ${roomId} by user: ${userId}`);
    
    if (!room) {
        throw new Error("Room not found");
    }

    if (!room.players.some(player => player.id === userId)) {
        throw new Error("User is not a participant in this room");
    }

    // Set the game as finished
    room.status = 'finished';
    room.markModified();

    await this.ormConnection.getRepository(Room).save(room);
    return room;
  }

  async getRoomsByUserAndStatus(userId: number, status?: 'playing' | 'pending' | 'finished' | 'cancelled'): Promise<Room[]> {
    const query = this.ormConnection
        .getRepository(Room)
        .createQueryBuilder('room')
        .leftJoinAndSelect('room.players', 'players')
        .leftJoinAndSelect('room.crossword', 'crossword')
        .where('players.id = :userId', { userId });

    if (status) {
        query.andWhere('room.status = :status', { status });
    }

    return query.getMany();
  }

  async handleGuess(roomId: number, userId: number, x: number, y: number, guess: string): Promise<Room> {
    const room = await this.getRoomById(roomId);
    if (!room) throw new Error("Room not found");

    const isCorrect = await this.crosswordService.checkGuess(room, { x, y }, guess);

    // Get or create game stats for this user and room
    let gameStats = await this.ormConnection.getRepository(GameStats).findOne({
      where: { userId, roomId }
    });

    if (!gameStats) {
      const user = await this.ormConnection.getRepository(User).findOneBy({ id: userId });
      if (!user) throw new Error("User not found");

      gameStats = new GameStats();
      gameStats.user = user;
      gameStats.room = room;
      gameStats.userId = userId;
      gameStats.roomId = roomId;
      gameStats.userEloAtGame = user.eloRating;
    }

    // Update stats based on guess result
    if (isCorrect) {
      gameStats.correctGuesses++;
      gameStats.correctGuessRecords.push({
        x,
        y,
        letter: guess,
        timestamp: new Date()
      });
      
      // Update room state
      room.found_letters[x * room.crossword.col_size + y] = guess;
      room.scores[userId] = (room.scores[userId] || 0) + config.game.points.correct;
      room.markModified();
    } else {
      gameStats.incorrectGuesses++;
      room.scores[userId] = (room.scores[userId] || 0) + config.game.points.incorrect;
      room.markModified();
    }

    // Save both game stats and room
    await Promise.all([
      this.ormConnection.getRepository(GameStats).save(gameStats),
      this.ormConnection.getRepository(Room).save(room)
    ]);

    return room;
  }
}
