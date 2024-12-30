import { DataSource } from "typeorm";
import { Room } from "../entities/Room";
import { User } from "../entities/User";
import { CrosswordService } from "./CrosswordService";
import { EloService } from "./EloService";
import { config } from "../config/config";
import { fastify } from "../fastify";

export class RoomService {
  private crosswordService: CrosswordService;
  private eloService: EloService;
  private ormConnection: DataSource;

  constructor(ormConnection: DataSource) {
    this.ormConnection = ormConnection;
    this.crosswordService = new CrosswordService(ormConnection);
    this.eloService = new EloService(ormConnection.getRepository(User));
  }

  async getRoomById(roomId: number): Promise<Room> {
    return this.ormConnection
      .getRepository(Room)
      .findOne({ where: { id: roomId } });
  }

  async joinRoom(userId: number, difficulty: string): Promise<Room> {
    let room = await this.findEmptyRoomByDifficulty(difficulty);

    if (room) {
      fastify.log.info(`Found room with id: ${room.id}`);
      await this.joinExistingRoom(room, userId);
    } else {
      await this.createRoom(userId, difficulty);
    }

    return room;
  }

  async joinExistingRoom(room: Room, userId: number): Promise<void> {
    fastify.log.info(`Joining room with id: ${userId}`);
    const player = await this.ormConnection
      .getRepository(User)
      .findOneBy({ id: userId });
    fastify.log.info(player);
    room.player_2 = player;
    await this.ormConnection.getRepository(Room).save(room);
  }

  async createRoom(userId: number, difficulty: string): Promise<void> {
    const crossword = await this.crosswordService.getCrosswordByDifficulty(
      difficulty,
    );

    const room = new Room();
    room.player_1 = await this.ormConnection
      .getRepository(User)
      .findOneBy({ id: userId });
    room.crossword = crossword;
    room.difficulty = difficulty;

    room.found_letters = await this.crosswordService.createFoundLettersTemplate(
      crossword.id,
    );

    await this.ormConnection.getRepository(Room).save(room);
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

    if (![room.player_1.id, room.player_2.id].includes(userId)) {
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
    const remainingBlanks = room.found_letters.filter(letter => letter === '').length;
    if (remainingBlanks === 0) {
      // Game is over, determine winner and update ELO
      const winner = room.player_1_score > room.player_2_score ? room.player_1 : room.player_2;
      const loser = room.player_1_score > room.player_2_score ? room.player_2 : room.player_1;
      
      // In case of a tie, don't update ELO
      if (room.player_1_score !== room.player_2_score) {
        await this.eloService.updateEloRatings(winner.id, loser.id);
      }
    }

    return room;
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
    room.player_1.id === userId
      ? (room.player_1_score += points)
      : (room.player_2_score += points);
  }

  private async findEmptyRoomByDifficulty(difficulty: string): Promise<Room> {
    return this.ormConnection.getRepository(Room).findOne({
      where: { player_2: null, difficulty },
      order: { created_at: "ASC" },
    });
  }
}
