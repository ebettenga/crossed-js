import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { User } from "./User";
import { Room } from "./Room";

interface GuessRecord {
  x: number;
  y: number;
  letter: string;
  timestamp: Date;
}

@Entity()
export class GameStats {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true })
  user: User;

  @ManyToOne(() => Room, { eager: true })
  room: Room;

  @Column("integer")
  userId: number;

  @Column("integer")
  roomId: number;

  @Column("integer")
  correctGuesses: number;

  @Column("integer")
  incorrectGuesses: number;

  @Column("integer")
  userEloAtGame: number;

  @Column("jsonb", { nullable: true })
  correctGuessRecords: GuessRecord[];

  @CreateDateColumn()
  createdAt: Date;

  constructor() {
    this.correctGuesses = 0;
    this.incorrectGuesses = 0;
    this.correctGuessRecords = [];
  }
}