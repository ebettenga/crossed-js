import { useQuery } from '@tanstack/react-query';
import { get } from './api';

export interface GameStats {
    isWinner: boolean;
    eloChange: number;
    accuracy: number;
    correctGuesses: number;
    incorrectGuesses: number;
    longestStreak: number;
    opponentStats: {
        accuracy: number;
        correctGuesses: number;
        incorrectGuesses: number;
    };
    guessTimings: number[];
}

export function useGameStats(roomId: number | undefined) {
    return useQuery<GameStats>({
        queryKey: ['gameStats', roomId],
        queryFn: async () => {
            if (!roomId) throw new Error('Room ID is required');
            return get(`/rooms/${roomId}/stats`);
        },
        enabled: !!roomId,
        gcTime: 1000 * 60 * 60,
    });
}
