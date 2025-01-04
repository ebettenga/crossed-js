import { Column, Entity, PrimaryGeneratedColumn, OneToOne, ManyToMany, OneToMany, AfterLoad } from "typeorm";
import { Room } from "./Room";
import { GameStats } from "./GameStats";

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

  @Column({ type: 'integer', default: 1200 })
  eloRating: number;

  @OneToMany(() => GameStats, stats => stats.user, { eager: true })
  gameStats: GameStats[];

  // Virtual properties for statistics
  gamesWon: number;
  gamesLost: number;
  guessAccuracy: number;
  winRate: number;

  @AfterLoad()
  async calculateStats() {
    if (!this.gameStats) return;

    // Calculate games won and lost
    const totalGames = this.gameStats.length;
    this.gamesWon = this.gameStats.filter(stat => stat.isWinner).length;
    this.gamesLost = totalGames - this.gamesWon;

    // Calculate guess accuracy
    const totalGuesses = this.gameStats.reduce((sum, stat) => 
        sum + stat.correctGuesses + stat.incorrectGuesses, 0);
    const correctGuesses = this.gameStats.reduce((sum, stat) => 
        sum + stat.correctGuesses, 0);
    this.guessAccuracy = totalGuesses > 0 ? (correctGuesses / totalGuesses) * 100 : 0;

    // Calculate win rate
    this.winRate = totalGames > 0 ? (this.gamesWon / totalGames) * 100 : 0;
  }

  toJSON() {
    return {
      ...this,
      gameStats: undefined,
      gamesWon: this.gamesWon || 0,
      gamesLost: this.gamesLost || 0,
      guessAccuracy: Math.round(this.guessAccuracy || 0),
      winRate: Math.round(this.winRate || 0),
    };
  }

  @ManyToMany(() => Room, room => room.players)
  rooms: Room[];
}
