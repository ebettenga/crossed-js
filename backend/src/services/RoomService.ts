import { DataSource } from 'typeorm';
import { Room } from '../entities/Room';
import { User } from '../entities/User';
import { CrosswordService } from './CrosswordService';

export class RoomService {
  crosswordService;
  ormConnection: DataSource;

  constructor(ormConnection: DataSource) {
    this.ormConnection = ormConnection;
    this.crosswordService = new CrosswordService(ormConnection);
  }

  async getRoomById(roomId: number): Promise<Room> {
    return this.ormConnection.getRepository(Room).findOne({ where: { id: roomId } });
  }

  async joinRoom(userId: number, difficulty: string): Promise<Room> {
    let room = await this.findEmptyRoomByDifficulty(difficulty);

    if (room) {
      room = await this.joinExistingRoom(room, userId);
    } else {
      room = await this.createRoom(userId, difficulty);
    }

    return room;
  }

  private async joinExistingRoom(room: Room, userId: number): Promise<Room> {
    room.player_2 = await this.ormConnection.getRepository(User).findOneBy({ id: userId });
    await this.ormConnection.getRepository(Room).save(room);
    return room;
  }

  private async createRoom(userId: number, difficulty: string): Promise<Room> {
    const crossword = await this.crosswordService.getCrosswordByDifficulty(difficulty);

    const room = new Room();
    room.player_1 = await this.ormConnection.getRepository(User).findOneBy({ id: userId });
    room.crossword = crossword;
    room.difficulty = difficulty;
    room.found_letters = this.crosswordService.createFoundLettersTemplate(crossword.id);

    await this.ormConnection.getRepository(Room).save(room);
    return room;
  }

  private async findEmptyRoomByDifficulty(difficulty: string): Promise<Room> {
    return this.ormConnection.getRepository(Room).findOne({ where: { player_2: null, difficulty }, order: { created_at: 'ASC' } });
  }

  async guess(roomId: number, coordinates: { x: number; y: number }, guess: string, userId: number): Promise<Room> {
    const room = await this.ormConnection.getRepository(Room).findOneBy({ id: roomId });
    const isCorrect = await this.crosswordService.checkGuess(room, coordinates, guess);

    if (isCorrect) {
      this.addPoints(room, userId);
      this.updateFoundBoard(room, coordinates, guess);
    } else {
      this.removePoints(room, userId);
    }

    await this.ormConnection.getRepository(Room).save(room);
    return room;
  }

  private updateFoundBoard(room: Room, coordinates: { x: number; y: number }, guess: string): void {
    const xNumber = coordinates.x === 0 ? 0 : coordinates.x * room.crossword.row_size;
    const space = xNumber + coordinates.y;
    room.found_letters[space] = guess;
  }

  private addPoints(room: Room, userId: number): void {
    if (room.player_1.id === userId) {
      room.player_1_score += 3;
    } else {
      room.player_2_score += 3;
    }
  }

  private removePoints(room: Room, userId: number): void {
    if (room.player_1.id === userId) {
      room.player_1_score -= 1;
    } else {
      room.player_2_score -= 1;
    }
  }
}
