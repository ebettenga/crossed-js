import { DataSource } from 'typeorm';
import { Crossword } from '../entities/Crossword';
import { Room } from '../entities/Room';

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

  createAnswerBoard(crossword: Crossword): string[][] {
    const answerBoard = [];
    for (let r = 0; r < crossword.col_size; r++) {
      const rowStart = r * crossword.row_size;
      answerBoard.push(
        crossword.grid.slice(rowStart, rowStart + crossword.row_size),
      );
    }
    return answerBoard;
  }

  checkGuess(
    room: Room,
    coordinates: { x: number; y: number },
    guess: string,
  ): boolean {
    const crossword = room.crossword;
    const board = this.createAnswerBoard(crossword);
    return board[coordinates.x][coordinates.y] === guess.toUpperCase();
  }
}
