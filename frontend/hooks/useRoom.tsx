import { useMutation, useQueryClient } from "@tanstack/react-query";
import { post } from "./api";

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
};

export type Room = {
    id: number;
    created_at: string;
    difficulty: string;
    type: '1v1' | '2v2' | 'free4all';
    status: 'playing' | 'pending' | 'finished' | 'cancelled';
    player_count: number;
    players: Player[];
    scores: { [key: number]: number };
    crossword: {
        col_size: number;
        row_size: number;
        gridnums: number[];
        clues: {
            across: string[];
            down: string[];
        };
        title: string;
        author: string;
    };
    found_letters: string[];
    board: Square[][];
};

type JoinRoomParams = {
    difficulty: string;
    type: '1v1' | '2v2' | 'free4all';
};

export const useJoinRoom = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (params: JoinRoomParams) => {
            const { data } = await post('/rooms/join', params);
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['rooms', 'playing'] });
            queryClient.invalidateQueries({ queryKey: ['rooms', 'pending'] });
        },
    });
};

