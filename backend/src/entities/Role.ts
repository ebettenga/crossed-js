import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("enum", { enum: ["admin", "user"] })
  name: string;

  @Column("text")
  description: string;
}
