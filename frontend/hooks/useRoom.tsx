import { useMutation } from "@tanstack/react-query";
import { post } from "./api";


export type Room = {
    id: number;
    type: '1v1' | '2v2' | 'free4all';
    status: 'playing' | 'pending' | 'finished' | 'cancelled';
    player_count: number;
    players: {
        id: number;
        username: string;
        email: string;
        description: string | null;
        created_at: string;
        roles: string[];
        score: number;
    }[];
    crossword: {
        id: number;
        grid: string[];
        gridnums: any[];
        clues: {
            across: string[];
            down: string[];
        };
        answers: {
            across: string[];
            down: string[];
        };
        col_size: number;
        row_size: number;
        circles: any[];
        author: string;
        title: string;
        date: string;
        dow: string;
        notepad: string;
        jnote: string;
        shadecircles: boolean;
    };
    scores: { [key: number]: number };
    created_at: string;
    difficulty: string;
    found_letters: string[];
}

type JoinRoomParams = {
    difficulty: 'easy' | 'medium' | 'hard';
};

export const useJoinRoom = () => useMutation<Room, Error, JoinRoomParams>({
    mutationFn: async (params) => { return await post("/rooms/join", params)}
});

