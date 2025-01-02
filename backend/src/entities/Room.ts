import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  CreateDateColumn,
  OneToOne,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from './User';
import { Crossword } from './Crossword';

// Define game type enum
export type GameType = '1v1' | '2v2' | 'free4all';
export type GameStatus = 'playing' | 'pending' | 'finished' | 'cancelled';


export const PLAYER_COUNT_MAP: Record<GameType, number> = {
  '1v1': 2,
  '2v2': 4,
  'free4all': 5
};

@Entity()
export class Room {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: ['1v1', '2v2', 'free4all'],
    default: '1v1'
  })
  type: GameType;

  @Column({
    type: 'enum',
    enum: ['playing', 'pending', 'finished', 'cancelled'],
    default: 'pending'
  })
  status: GameStatus;

  @Column('int', { default: 0 })
  player_count: number;
  @ManyToMany(() => User, { eager: true })
  @JoinTable({
    name: "room_players",
    joinColumn: { name: "room_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "user_id", referencedColumnName: "id" }
  })
  players: User[];

  @OneToOne(() => Crossword, { eager: true })
  @JoinColumn()
  crossword: Crossword;

  // Store scores as a JSON object with user IDs as keys
  @Column('simple-json', { default: {} })
  scores: { [key: number]: number };

  @CreateDateColumn()
  created_at: Date;

  @Column('text')
  difficulty: string;

  @Column('char', { array: true, default: '{}' })
  found_letters: string[];
}
