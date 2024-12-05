import { DataSource } from 'typeorm';
import { Room } from '../entities/Room';
import { User } from '../entities/User';
import { CrosswordService } from './CrosswordService';
import { config } from '../config/config';
import { fastify } from '../fastify';

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

  async joinRoom(userId: number, difficulty: string): Promise<Room> {
    let room = await this.findEmptyRoomByDifficulty(difficulty);

    if (room) {
      fastify.logger.info(`Found room with id: ${room.id}`);
      await this.joinExistingRoom(room, userId);
    } else {
      await this.createRoom(userId, difficulty);
    }

    return room;
  }

  async joinExistingRoom(room: Room, userId: number): Promise<void> {
    fastify.logger.info(`Joining room with id: ${userId}`);
    const player = await this.ormConnection
      .getRepository(User)
      .findOneBy({ id: userId });
    fastify.logger.info(player);
    room.player_2 = player;
    await this.ormConnection.getRepository(Room).save(room);
  }

  async createRoom(userId: number, difficulty: string): Promise<void> {
    const crossword =
      await this.crosswordService.getCrosswordByDifficulty(difficulty);

    const room = new Room();
    room.player_1 = await this.ormConnection
      .getRepository(User)
      .findOneBy({ id: userId });
    room.crossword = crossword;
    room.difficulty = difficulty;

    room.found_letters = await this.crosswordService.createFoundLettersTemplate(
      crossword.id,
    );

    fastify.logger.info(room.found_letters);

    await this.ormConnection.getRepository(Room).save(room);
  }

  private async findEmptyRoomByDifficulty(difficulty: string): Promise<Room> {
    return this.ormConnection
      .getRepository(Room)
      .findOne({
        where: { player_2: null, difficulty },
        order: { created_at: 'ASC' },
      });
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
    const isCorrect = await this.crosswordService.checkGuess(
      room,
      coordinates,
      guess,
    );

    if (isCorrect) {
      room = this.addPoints(room, userId);
      room = this.updateFoundBoard(room, coordinates, guess);
    } else {
      room = this.removePoints(room, userId);
    }

    await this.ormConnection.getRepository(Room).save(room);
    return room;
  }

  private updateFoundBoard(
    room: Room,
    coordinates: { x: number; y: number },
    guess: string,
  ): Room {
    const xNumber =
      coordinates.x === 0 ? 0 : coordinates.x * room.crossword.row_size;
    const space = xNumber + coordinates.y;
    room.found_letters[space] = guess;

    return room;
  }

  private addPoints(room: Room, userId: number): Room {
    room.player_1.id === userId
      ? (room.player_1_score += config.game.points)
      : (room.player_2_score += config.game.points);
    return room;
  }

  private removePoints(room: Room, userId: number): Room {
    room.player_1.id === userId
      ? (room.player_1_score -= 1)
      : (room.player_2_score -= 1);
    return room;
  }
}
