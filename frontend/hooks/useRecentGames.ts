import { useQuery } from "@tanstack/react-query";
import { get } from "./api";

export interface RecentGame {
  room: {
    id: number;
    difficulty: string;
    type: string;
    status: string;
    created_at: string;
    completed_at: string | null;
    scores: Record<string, number>;
  };
  stats: {
    correctGuesses: number;
    incorrectGuesses: number;
    isWinner: boolean;
    eloAtGame: number;
  };
}

export function useRecentGames(startDate?: Date, endDate?: Date) {
  const params: Record<string, string> = {};

  if (startDate) params.startTime = startDate.toISOString();
  if (endDate) params.endTime = endDate.toISOString();

  return useQuery<RecentGame[]>({
    queryKey: ["recentGames", startDate, endDate],
    queryFn: () => get("/rooms/recent", { params }),
  });
}
