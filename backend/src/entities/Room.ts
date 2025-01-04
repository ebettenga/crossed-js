import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./User";
import { Crossword } from "./Crossword";

export type GameType = "1v1" | "2v2" | "free4all";
export type GameStatus = "playing" | "pending" | "finished" | "cancelled";

type Clues = {
  across: string[];
  down: string[];
};

enum PopulatingState {
  READING,
  WRITING,
}

interface Clue {
  number: number;
  hint: string;
}

export enum SquareType {
  SOLVED,
  BLANK,
  BLACK,
  CIRCLE_BLANK,
  CIRCLE_SOLVED,
}

export interface Square {
  id: number;
  squareType: SquareType;
  letter?: string;
  gridnumber: number | null;
  x: number;
  y: number;
  downQuestion?: string;
  acrossQuestion?: string;
}

@Entity()
export class Room {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: ["1v1", "2v2", "free4all"],
    default: "1v1",
  })
  type: GameType;

  @Column({
    type: "enum",
    enum: ["playing", "pending", "finished", "cancelled"],
    default: "pending",
  })
  status: GameStatus;

  @ManyToMany(() => User, { eager: true })
  @JoinTable({
    name: "room_players",
    joinColumn: { name: "room_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "user_id", referencedColumnName: "id" },
  })
  players: User[];

  @OneToOne(() => Crossword, { eager: true })
  @JoinColumn()
  crossword: Crossword;

  // Store scores as a JSON object with user IDs as keys
  @Column("simple-json", { default: {} })
  scores: { [key: number]: number };

  @CreateDateColumn()
  created_at: Date;

  @Column("text")
  difficulty: string;

  @Column("char", { array: true, default: "{}" })
  found_letters: string[];

  get player_count(): number {
    return this.players.length;
  }

  toView() {
    return {
      id: this.id,
      created_at: this.created_at,
      difficulty: this.difficulty,
      type: this.type,
      status: this.status,
      player_count: this.player_count,
      players: this.players.map((player) => ({
        id: player.id,
        username: player.username,
        score: this.scores[player.id] || 0,
      })),
      scores: this.scores,
      crossword: {
        col_size: this.crossword.col_size,
        row_size: this.crossword.row_size,
        gridnums: this.crossword.gridnums,
        clues: this.crossword.clues,
        title: this.crossword.title,
        author: this.crossword.author,
      },
      found_letters: this.found_letters,
      board: this.createBoard(),
    };
  }

  private getSquareType(
    hasLetter: boolean,
    isCircled: boolean,
    black: boolean,
  ): SquareType {
    if (black) return SquareType.BLACK;
    if (hasLetter) {
      return isCircled ? SquareType.CIRCLE_SOLVED : SquareType.SOLVED;
    } else {
      return isCircled ? SquareType.CIRCLE_BLANK : SquareType.BLANK;
    }
  }

  private createSquares(): Square[] {
    return this.found_letters.map((letterCharacter: string, index) => {
      const x = Math.floor(index / this.crossword.row_size);
      return {
        id: index,
        x,
        y: index - x * this.crossword.row_size,
        squareType: this.getSquareType(
          /[a-zA-z]/.test(letterCharacter),
          this.crossword.circles ? this.crossword.circles[index] === 1 : false,
          letterCharacter === "."
        ),
        gridnumber:
          parseInt(this.crossword.gridnums[index]) !== 0
            ? parseInt(this.crossword.gridnums[index])
            : null,
        letter: letterCharacter !== "*" ? letterCharacter : undefined,
      } as Square;
    });
  }

  private arrayToMatrix<T>(array: T[], row_length: number): T[][] {
    return Array(Math.ceil(array.length / row_length))
      .fill("")
      .reduce((acc, _, index) => {
        return [...acc, [...array].splice(index * row_length, row_length)];
      }, [] as T[][]);
  }

  private createClueArray(clues: string[]): Clue[] {
    return clues.map((clue) => {
      const clueArray = clue.split(".");
      const clueNumber = parseInt(clueArray[0]);
      return { number: clueNumber, hint: clue };
    });
  }

  private getClueByQuestionNumber(
    clueList: Clue[],
    questionNumber: number | null,
  ): Clue | undefined {
    return clueList.find((clue) => clue.number === questionNumber);
  }


  private createBoard(): Square[][] {
    const squares = this.createSquares();
    const board = this.arrayToMatrix(squares, this.crossword.row_size);

    // Add clues to squares
    const acrossClues = this.createClueArray(this.crossword.clues.across);
    const downClues = this.createClueArray(this.crossword.clues.down);

    // Populate across clues
    board.forEach((row, rowIndex) => {
      row.forEach((square, colIndex) => {
        // Find most recent non-black square in the row or first square
        let lastNonBlackSquare: Square | null = square;
        for (let i = colIndex; i >= 0; i--) {
          if (row[i].squareType !== SquareType.BLACK) {
            lastNonBlackSquare = row[i];
          }
          if (row[i].squareType === SquareType.BLACK) {
            break;
          }
        }
        
        if (lastNonBlackSquare) {
        square.acrossQuestion = this.getClueByQuestionNumber(acrossClues, lastNonBlackSquare.gridnumber)?.hint;
        }
      });
    });
    // Populate down clues

    board.forEach((row, rowIndex) => {
      row.forEach((square, colIndex) => {
        // Find most recent non-black square in the row or first square
        let lastNonBlackSquare: Square | null = square;
        for (let i = rowIndex; i >= 0; i--) {
          if (board[i][colIndex].squareType !== SquareType.BLACK) {
            lastNonBlackSquare = board[i][colIndex];
          }
          if (board[i][colIndex].squareType === SquareType.BLACK) {
            break;
          }
        }
        if (lastNonBlackSquare) {
          square.downQuestion = this.getClueByQuestionNumber(downClues, lastNonBlackSquare.gridnumber)?.hint;
        }
      });
    });

    return board;
  }
}