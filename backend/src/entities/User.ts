import { Entity, PrimaryGeneratedColumn, Column, OneToOne } from "typeorm";
import { Role } from "./Role";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("text")
  username: string;


  @Column("text")
  _password: string;

  @Column("text")
  githubId: string;

  @OneToOne(() => Role)
  role: Role;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
