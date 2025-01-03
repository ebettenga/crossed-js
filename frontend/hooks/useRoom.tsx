import { useMutation, useQueryClient } from "@tanstack/react-query";
import { post } from "./api";


export type Room = {
    id: number;
    type: '1v1' | '2v2' | 'free4all';
    status: 'playing' | 'pending' | 'finished' | 'cancelled';
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

