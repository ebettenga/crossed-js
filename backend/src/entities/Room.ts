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

  @ManyToOne(() => User, {eager: true})
  @JoinColumn({ name: "player_1_id" })
  player_1: User;

  @Column("int")
  player_1_id: number;

  @ManyToOne(() => User, {eager: true})
  @JoinColumn({ name: "player_2_id" })
  player_2: User;

  @Column("int")
  player_2_id: number;

  @OneToOne(() => Crossword)
  @JoinColumn()
  crossword: Crossword;

  @Column('int', { default: 0 })
  player_1_score: number;

  @Column('int', { default: 0 })
  player_2_score: number;

  @CreateDateColumn()
  created_at: Date;

  @Column('text')
  difficulty: string;

  @Column('char', { array: true, default: '{}' })
  found_letters: string[];
}
