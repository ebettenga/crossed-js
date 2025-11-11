import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

export type Clues = {
  across: string[];
  down: string[];
};

const dateTransformer = {
  to: (value: Date | string | null) => {
    if (!value) {
      return value;
    }
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return `${value}`.slice(0, 10);
  },
  from: (value: string | null) => {
    if (!value) {
      return value;
    }
    return new Date(value);
  },
};

@Entity()
export class Crossword {
  @PrimaryGeneratedColumn()
  id: number;

  @Column("jsonb")
  clues: Clues;

  @Column("jsonb")
  answers: {
    across: string[];
    down: string[];
  };

  @Column("text", { nullable: true })
  author: string;

  @Column("text", { nullable: true })
  created_by: string;

  @Column("text", { nullable: true })
  creator_link: string;

  @Column("simple-array", { nullable: true })
  circles: number[];

  @Column("date", { nullable: true, transformer: dateTransformer })
  date: Date | null;

  @Column("text", { nullable: true })
  dow: string;

  @Column("simple-array", { nullable: true })
  grid: string[];

  @Column("simple-array", { nullable: true })
  gridnums: string[];

  @Column("boolean", { nullable: true })
  shadecircles: boolean;

  @Column("int", { nullable: true })
  col_size: number;

  @Column("int", { nullable: true })
  row_size: number;

  @Column("text", { nullable: true })
  jnote: string;

  @Column("text", { nullable: true })
  notepad: string;

  @Column("text", { nullable: true })
  title: string;

  @Column("text", { default: "general" })
  pack: string;
}
