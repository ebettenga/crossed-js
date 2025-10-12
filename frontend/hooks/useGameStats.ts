import { useQuery } from "@tanstack/react-query";
import { get } from "./api";

export interface GameStats {
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
}

export const useGameStats = (
  roomId: number | undefined,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["gameStats", roomId],
    queryFn: async () => {
      if (!roomId) throw new Error("Room ID is required");
      return await get<GameStats[]>(`/rooms/${roomId}/stats`);
    },
    enabled: enabled && !!roomId,
    staleTime: Infinity, // Game stats don't change once the game is finished
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
  });
};
