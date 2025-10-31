import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import type { User } from "./User";

@Entity()
@Unique(["userId", "pack"])
export class UserCrosswordPack {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("integer")
  userId: number;

  @ManyToOne("User", { onDelete: "CASCADE" })
  user: User;

  @Column("text")
  pack: string;
}
