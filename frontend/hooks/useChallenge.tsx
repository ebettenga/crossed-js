import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { post, get } from "./api";
import { useSocket } from "./socket";
import { useEffect } from "react";
import { Room } from "./useRoom";
import { useRouter } from "expo-router";     

export const useChallenge = () => {
    const queryClient = useQueryClient();
    const { socket, isConnected } = useSocket();
    const router = useRouter();

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

    const { data: challenges = [] } = useQuery<Room[]>({
        queryKey: ['challenges', 'pending'],
        queryFn: () => get('/rooms/challenges/pending'),
        refetchInterval: 10000, 
    });

    const sendChallenge = useMutation({
        mutationFn: async ({ challengedId, difficulty }: { challengedId: number; difficulty: string }) => {
            const { data } = await post('/rooms/challenge', { challengedId, difficulty });
            return data as Room;
        },
        onSuccess: (room) => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            queryClient.invalidateQueries({ queryKey: ['challenges', 'pending'] });
            router.push(`/game?roomId=${room.id}`);
        },
    });

    const acceptChallenge = useMutation({
        mutationFn: async (roomId: number) => {
            const { data } = await post(`/rooms/challenge/${roomId}/accept`, { roomId });
            return data as Room;
        },
        onSuccess: (room) => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            queryClient.invalidateQueries({ queryKey: ['challenges', 'pending'] });
            router.push(`/game?roomId=${room.id}`);
        },
    });

    const rejectChallenge = useMutation({
        mutationFn: async (roomId: number) => {
            const { data } = await post(`/rooms/challenge/${roomId}/reject`, { roomId });
            return data as Room;
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
    };
}; 