import { useQuery } from '@tanstack/react-query';
import { get } from './api';

export interface RecentGame {
    room: {
        id: number;
        difficulty: string;
        type: string;
        status: string;
        created_at: string;
        scores: Record<string, number>;
    };
    stats: {
        correctGuesses: number;
        incorrectGuesses: number;
        isWinner: boolean;
        eloAtGame: number;
    };
}

export function useRecentGames() {
    return useQuery<RecentGame[]>({
        queryKey: ['recentGames'],
        queryFn: () => get('/rooms/recent'),
    });
} 