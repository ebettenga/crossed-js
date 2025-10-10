import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { User } from "./User";

export type FeedbackType = "support" | "suggestion";

@Entity()
export class Support {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: ["support", "suggestion"],
  })
  type: FeedbackType;

  @Column("text")
  comment: string;

  @ManyToOne("User", { eager: true })
  user: User;

  @Column("integer")
  userId: number;

  @CreateDateColumn()
  created_at: Date;

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      comment: this.comment,
      userId: this.userId,
      user: {
        id: this.user.id,
        username: this.user.username,
      },
      created_at: this.created_at,
    };
  }
}
