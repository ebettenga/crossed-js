import { DataSource, FindOperator, LessThan } from "typeorm";
import { PLAYER_COUNT_MAP, Room } from "../entities/Room";
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

  async joinRoom(userId: number, difficulty: string): Promise<Room> {
    let room = await this.findEmptyRoomByDifficulty(difficulty);

    if (room) {
      fastify.log.info(`Found room with id: ${room.id}`);
      await this.joinExistingRoom(room, userId);
      return room;
    } else {
      return await this.createRoom(userId, difficulty);
    }
  }

  async joinExistingRoom(room: Room, userId: number): Promise<void> {
    fastify.log.info(`Joining room with id: ${room.id} by user: ${userId}`);
    const player = await this.ormConnection
      .getRepository(User)
      .findOneBy({ id: userId });
    
    if (!player) throw new Error("User not found");
    
    room.players.push(player);
    room.player_count = room.players.length;
    
    // If room is full based on game type, change status to playing
    const maxPlayers = room.type === '1v1' ? 2 : room.type === '2v2' ? 4 : 4;
    if (room.player_count === maxPlayers) {
      room.status = 'playing';
    }

    await this.ormConnection.getRepository(Room).save(room);
  }

  async createRoom(userId: number, difficulty: string): Promise<Room> {
    const crossword = await this.crosswordService.getCrosswordByDifficulty(
      difficulty,
    );

    const player = await this.ormConnection
      .getRepository(User)
      .findOneBy({ id: userId });

    if (!player) throw new Error("User not found");

    const room = new Room();
    room.players = [player];
    room.player_count = 1;
    room.crossword = crossword;
    room.difficulty = difficulty;
    room.type = '1v1'; // Default to 1v1 for now
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
    const remainingBlanks = room.found_letters.filter(letter => letter === '').length;
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

  private async findEmptyRoomByDifficulty(difficulty: string): Promise<Room> {
    return this.ormConnection.getRepository(Room).findOne({
      where: { 
        difficulty,
        status: 'pending',
        type: '1v1', // For now, only match 1v1 games
        player_count: LessThan(PLAYER_COUNT_MAP['1v1'])
      },
      order: { created_at: "ASC" },
    });
  }
}
