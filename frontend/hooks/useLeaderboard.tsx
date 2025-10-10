import { useQuery } from '@tanstack/react-query';
import { get } from './api';

export type LeaderboardEntry = {
  rank: number;
  roomId: number;
  score: number;
  user: { id: number; username: string; eloRating: number } | null;
  created_at: string;
  completed_at: string | null;
  timeTakenMs: number | null;
};

export const useTimeTrialLeaderboard = (roomId: number | undefined, limit: number = 10) => {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard', 'time-trial', roomId, limit],
    queryFn: async () => {
      if (!roomId) {
        throw new Error('Room ID is required');
      }
      return await get<LeaderboardEntry[]>(
        `/rooms/${roomId}/leaderboard/time-trial`,
        { params: { limit: limit.toString() } }
      );
    },
    enabled: !!roomId,
    staleTime: 1000 * 60, // Consider data fresh for 1 minute
    retry: 1,
  });
};
