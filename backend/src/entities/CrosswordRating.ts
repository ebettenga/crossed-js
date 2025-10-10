import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { User } from "./User";
import type { Crossword } from "./Crossword";

export type DifficultyRating = "too_easy" | "just_right" | "too_hard";

@Entity()
export class CrosswordRating {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne("User", { eager: true })
  user: User;

  @Column({ type: "int" })
  userId: number;

  @ManyToOne("Crossword", { eager: true })
  crossword: Crossword;

  @Column({ type: "int" })
  crosswordId: number;

  @Column({
    type: "enum",
    enum: ["too_easy", "just_right", "too_hard"],
    nullable: true,
  })
  difficultyRating: DifficultyRating;

  @Column({
    type: "int",
    nullable: true,
  })
  qualityRating: number;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: "timestamp", nullable: true })
  updated_at: Date;

  toJSON() {
    const { user, crossword, ...rest } = this;
    return {
      ...rest,
      user: user.toJSON(),
    };
  }
}
