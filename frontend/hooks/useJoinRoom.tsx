import { useMutation, useQueryClient } from "@tanstack/react-query";
import { post } from "./api";
import { useSocket } from "./socket";

export enum SquareType {
    SOLVED,
    BLANK,
    BLACK,
    CIRCLE_BLANK,
    CIRCLE_SOLVED,
}

export interface Square {
    id: number;
    squareType: SquareType;
    letter?: string;
    gridnumber: number | null;
    x: number;
    y: number;
    downQuestion?: string;
    acrossQuestion?: string;
}

export type Player = {
    id: number;
    username: string;
    score: number;
    eloRating: number;
    photo?: string | null;
};

export type Room = {
    id: number;
    created_at: string;
    completed_at?: string;
    difficulty: string;
    type: '1v1' | '2v2' | 'free4all' | 'time_trial';
    status: 'playing' | 'pending' | 'finished' | 'cancelled';
    player_count: number;
    players: Player[];
    scores: { [key: number]: number };
    crossword: {
        id: number;
        col_size: number;
        row_size: number;
        gridnums: number[];
        clues: {
            across: string[];
            down: string[];
        };
        title: string;
        author: string;
        created_by?: string;
        creator_link?: string;
    };
    found_letters: string[];
    board: Square[][];
    gameStats?: {
        userId: number;
        correctGuesses: number;
        incorrectGuesses: number;
        isWinner: boolean;
        eloAtGame: number;
        eloChange?: number;
        correctGuessDetails?: {
            row: number;
            col: number;
            letter: string;
            timestamp: Date;
        }[];
    }[];
};

type JoinRoomParams = {
    difficulty: string;
    type: '1v1' | '2v2' | 'free4all' | 'time_trial';
};

export const useJoinRoom = () => {
    const queryClient = useQueryClient();
    const { emit } = useSocket();
    return useMutation({
        mutationFn: async (params: JoinRoomParams) => {
            return await post<Room>('/rooms/join', params);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
        },
        onSuccess: (room) => {
            emit("loadRoom", JSON.stringify({ roomId: room.id }));
        },
    });
};
