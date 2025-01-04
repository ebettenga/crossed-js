import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { User } from "./User";
import { Room } from "./Room";

@Entity()
export class GameStats {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, user => user.gameStats)
    user: User;

    @Column("integer")
    userId: number;

    @ManyToOne(() => Room)
    room: Room;

    @Column("integer")
    roomId: number;

    @Column("integer")
    correctGuesses: number;

    @Column("integer")
    incorrectGuesses: number;

    @Column("boolean", { default: false })
    isWinner: boolean;

    @Column("float")
    eloAtGame: number;

    @CreateDateColumn()
    createdAt: Date;

    // Store coordinates and letters of correct guesses
    @Column("simple-json", { nullable: true })
    correctGuessDetails: {
        row: number;
        col: number;
        letter: string;
        timestamp: Date;
    }[];
}