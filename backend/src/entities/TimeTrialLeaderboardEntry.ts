import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Crossword } from "./Crossword.js";
import { User } from "./User.js";

@Entity()
@Unique(
  "UQ_time_trial_leaderboard_crossword_user",
  ["crossword", "user"],
)
export class TimeTrialLeaderboardEntry {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Crossword, { eager: true, onDelete: "CASCADE" })
  crossword!: Crossword;

  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  user!: User;

  @Column("int")
  roomId!: number;

  @Column("int")
  score!: number;

  @Column("int", { nullable: true })
  timeTakenMs!: number | null;

  @Column({ type: "timestamp", nullable: true })
  roomCompletedAt!: Date | null;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at!: Date;

  @Column({
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updated_at!: Date;
}
