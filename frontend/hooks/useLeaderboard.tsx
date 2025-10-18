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

export type LeaderboardResponse = {
  topEntries: LeaderboardEntry[];
  currentPlayerEntry?: LeaderboardEntry;
};

export type LeaderboardUser = {
  id: number;
  username: string;
  eloRating: number;
  photo?: string | null;
  gamesWon?: number;
  gamesLost?: number;
  guessAccuracy?: number;
  winRate?: number;
};

export type GlobalLeaderboardResponse = {
  topElo: Array<{
    rank: number;
    user: LeaderboardUser;
  }>;
  topTimeTrials: LeaderboardEntry[];
};

export const useTimeTrialLeaderboard = (roomId: number | undefined, limit: number = 10) => {
  return useQuery<LeaderboardResponse>({
    queryKey: ['leaderboard', 'time-trial', roomId, limit],
    queryFn: async () => {
      if (!roomId) {
        throw new Error('Room ID is required');
      }
      return await get<LeaderboardResponse>(
        `/rooms/${roomId}/leaderboard/time-trial`,
        { params: { limit: limit.toString() } }
      );
    },
    enabled: !!roomId,
    staleTime: 1000 * 60,
    retry: 1,
  });
};

export const useGlobalLeaderboard = (limit: number = 10) => {
  return useQuery<GlobalLeaderboardResponse>({
    queryKey: ['leaderboard', 'global', limit],
    queryFn: async () => {
      return await get<GlobalLeaderboardResponse>(
        '/leaderboard',
        { params: { limit: limit.toString() } }
      );
    },
    staleTime: 1000 * 60,
    retry: 1,
  });
};
