import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { post, get } from "./api";
import { useSocket } from "./socket";
import { useEffect } from "react";
import { Room } from "./useJoinRoom";
import { useRouter } from "expo-router";
import { useAds } from './useAds';

interface ChallengeResponse {
    data: Room;
}

export const useChallenge = () => {
    const queryClient = useQueryClient();
    const { socket, isConnected } = useSocket();
    const router = useRouter();
    const { showInterstitial } = useAds();

    useEffect(() => {
        if (!isConnected || !socket) return;

        const handleChallengeReceived = () => {
            queryClient.invalidateQueries({ queryKey: ['challenges', 'pending'] });
        };

        socket.on("challenge_received", handleChallengeReceived);

        return () => {
            socket.off("challenge_received", handleChallengeReceived);
        };
    }, [socket, isConnected]);

    const { data: challenges = [], refetch: refetchChallenges } = useQuery<Room[]>({
        queryKey: ['challenges', 'pending'],
        queryFn: () => get('/rooms/challenges/pending'),
        refetchInterval: 10000,
    });

    const sendChallenge = useMutation({
        mutationFn: async ({ challengedId, difficulty }: { challengedId: number; difficulty: string }) => {
            const response = await post('/rooms/challenge', { challengedId, difficulty }) as ChallengeResponse;
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            queryClient.invalidateQueries({ queryKey: ['challenges', 'pending'] });
        },
    });

    const acceptChallenge = useMutation({
        mutationFn: async (roomId: number) => {
            await showInterstitial();

            const response = await post(`/rooms/challenge/${roomId}/accept`, { roomId }) as ChallengeResponse;
            return response.data;
        },
        onSuccess: (room) => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            queryClient.invalidateQueries({ queryKey: ['challenges', 'pending'] });
            router.push(`/game?roomId=${room.id}`);
        },
    });

    const rejectChallenge = useMutation({
        mutationFn: async (roomId: number) => {
            const response = await post(`/rooms/challenge/${roomId}/reject`, { roomId }) as ChallengeResponse;
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            queryClient.invalidateQueries({ queryKey: ['challenges', 'pending'] });
        },
    });

    return {
        challenges,
        sendChallenge,
        acceptChallenge,
        rejectChallenge,
        refetch: refetchChallenges,
    };
};
