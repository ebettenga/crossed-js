import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, OneToOne } from "typeorm";
import { User } from "./User";
import { Crossword } from "./Crossword";

export type DifficultyRating = "too_easy" | "just_right" | "too_hard";

@Entity()
export class CrosswordRating {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true })
  user: User;

  @Column({ type: "int" })
  userId: number;

  @ManyToOne(() => Crossword, { eager: true })
  crossword: Crossword;

  @Column({ type: "int" })
  crosswordId: number;

  @Column({
    type: "enum",
    enum: ["too_easy", "just_right", "too_hard"],
    nullable: true
  })
  difficultyRating: DifficultyRating;

  @Column({
    type: "int",
    nullable: true,
    check: "quality_rating >= 1 AND quality_rating <= 5"
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
