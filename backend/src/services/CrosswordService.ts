import { DataSource } from 'typeorm';
import { Crossword } from '../entities/Crossword';
import { Room } from '../entities/Room';
import { fastify } from '../fastify';
import { NotFoundError } from '../errors/api';

export class CrosswordService {
  private ormConnection: DataSource;

  constructor(ormConnection: DataSource) {
    this.ormConnection = ormConnection;
  }

  async getCrosswords(
    page: number,
    limit: number,
    dow?: string,
    col_size?: number,
    row_size?: number,
  ) {
    const repository = this.ormConnection.getRepository(Crossword);
    const whereConditions: any = {};

    if (dow) {
      whereConditions.dow = dow;
    }

    if (col_size) {
      whereConditions.col_size = col_size;
    }

    if (row_size) {
      whereConditions.row_size = row_size;
    }

    const [items, total] = await repository.findAndCount({
      where: whereConditions,
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  async loadCrosswords() {
    const repository = this.ormConnection.getRepository(Crossword);
    const count = await repository.count();

    if (count > 0) {
      console.log('Crosswords already loaded');
      return;
    }

    // Load crosswords from files (implement file reading and parsing logic here)
  }

  async createFoundLettersTemplate(crosswordId: number): Promise<string[]> {
    const repository = this.ormConnection.getRepository(Crossword);
    const crossword = await repository.findOneBy({ id: crosswordId });

    if (!crossword) {
      throw new Error('Crossword not found');
    }

    return crossword.grid.map((value) => value.replace(/[A-Za-z]/g, '*'));
  }

  async getCrosswordByDifficulty(difficulty: string): Promise<Crossword> {
    const days = this.getDaysByDifficulty(difficulty);
    const crossword = await this.ormConnection
      .getRepository(Crossword)
      .createQueryBuilder('crossword')
      .where('crossword.dow IN (:...days)', { days })
      .orderBy('RANDOM()')
      .getOne();

    return crossword;
  }

  private getDaysByDifficulty(difficulty: string): string[] {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return ['Monday', 'Tuesday'];
      case 'medium':
        return ['Wednesday', 'Thursday'];
      case 'hard':
        return ['Friday', 'Saturday'];
      default:
        throw new Error('Invalid difficulty');
    }
  }

  checkGuess(
    room: Room,
    coordinates: { x: number; y: number },
    guess: string,
  ): boolean {
    const crossword = room.crossword;
    const guessPosition = coordinates.x * crossword.col_size + coordinates.y;
    try {
      return (
        crossword.grid[guessPosition].toUpperCase() === guess.toUpperCase()
      );
    } catch (e) {
      throw new NotFoundError('Invalid coordinates');
    }
  }
}
