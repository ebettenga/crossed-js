import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToOne,
} from 'typeorm';
import { User } from './User';
import { Crossword } from './Crossword';

@Entity()
export class Room {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User)
  @JoinColumn()
  player_1: User;

  @OneToOne(() => User)
  @JoinColumn()
  player_2: User;

  @OneToOne(() => Crossword, crossword => crossword.room)
  @JoinColumn()
  crossword: Crossword;

  @Column('int8', { default: 0 })
  player_1_score: number;

  @Column('int8', { default: 0 })
  player_2_score: number;

  @CreateDateColumn()
  created_at: Date;

  @Column('text')
  difficulty: string;

  @Column('char', { array: true, default: '{}' })
  found_letters: string[];
}
