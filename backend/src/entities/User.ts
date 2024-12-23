import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("text", { nullable: true })
  username: string;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date;

  @Column({
    type: "timestamp",
    select: false,
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updated_at: Date;

  @Column("text")
  email: string;

  @Column("text", { select: false })
  password: string;

  @Column("boolean", { default: false, select: false })
  confirmed_mail: boolean;

  @Column("simple-array", { default: "" })
  roles: string[];

  @Column("text", { nullable: true })
  description?: string;

  @Column("simple-json", { nullable: true, select: false })
  attributes?: { key: string; value: string }[];
}
