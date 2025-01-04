import { DataSource, FindOperator, LessThan, LessThanOrEqual } from "typeorm";
import { Room } from "../entities/Room";
import { User } from "../entities/User";
import { CrosswordService } from "./CrosswordService";
import { config } from "../config/config";
import { fastify } from "../fastify";

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

  async guess(
    roomId: number,
    coordinates: { x: number; y: number },
    guess: string,
    userId: number,
  ): Promise<Room> {
    let room = await this.ormConnection
      .getRepository(Room)
      .findOneBy({ id: roomId });

    if (!room.players.some(player => player.id === userId)) {
      throw new Error("User is not a participant in this room");
    }

    const isCorrect = await this.crosswordService.checkGuess(
      room,
      coordinates,
      guess,
    );

    if (isCorrect) {
      this.modifyPoints(room, userId, config.game.points.correct);
      this.updateFoundBoard(room, coordinates, guess);
    } else {
      this.modifyPoints(room, userId, config.game.points.incorrect);
    }

    await this.ormConnection.getRepository(Room).save(room);

    // Check if this was the last letter to be found
    const remainingBlanks = room.found_letters.filter(letter => letter === '*').length;
    if (remainingBlanks === 0) {
      room.status = 'finished';
      await this.handleGameEnd(room);
    }

    return room;
  }

  private async handleGameEnd(room: Room): Promise<void> {
    // Get scores array sorted by score (highest first)
    const playerScores = Object.entries(room.scores)
      .map(([playerId, score]) => ({ 
        playerId: parseInt(playerId), 
        score 
      }))
      .sort((a, b) => b.score - a.score);

    // TODO: Update ELO calculations for multiple players


    await this.ormConnection.getRepository(Room).save(room);
  }

  private updateFoundBoard(
    room: Room,
    coordinates: { x: number; y: number },
    guess: string,
  ): void {
    const space = coordinates.x * room.crossword.row_size + coordinates.y;
    room.found_letters[space] = guess;

  }

  private modifyPoints(room: Room, userId: number, points: number): void {
    if (!room.scores[userId]) {
      room.scores[userId] = 0;
    }
    room.scores[userId] += points;
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
}
