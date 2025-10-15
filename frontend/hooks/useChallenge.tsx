import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { post, get } from "./api";
import { useSocket } from "./socket";
import { useEffect } from "react";
import { Room } from "./useJoinRoom";
import { useRouter } from "expo-router";
import { useUser } from "./users";

export const CHALLENGES_UPDATED_EVENT = 'challenges:updated';

export const useChallenge = () => {
    const queryClient = useQueryClient();
    const { socket, isConnected } = useSocket();
    const router = useRouter();
    const { data: currentUser } = useUser();

    useEffect(() => {
        if (!isConnected || !socket) return;

        const invalidateChallenges = () => {
            queryClient.invalidateQueries({ queryKey: ['challenges', 'pending'] });
        };

        socket.on("challenge_received", invalidateChallenges);
        socket.on(CHALLENGES_UPDATED_EVENT, invalidateChallenges);

        return () => {
            socket.off("challenge_received", invalidateChallenges);
            socket.off(CHALLENGES_UPDATED_EVENT, invalidateChallenges);
        };
    }, [socket, isConnected, queryClient]);

    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleGameStarted = (data: { room: Room }) => {
            if (!data?.room || !currentUser) return;

            const isParticipant = data.room.players?.some(player => player.id === currentUser.id);
            if (isParticipant) {
                router.push(`/game?roomId=${data.room.id}`);
            }
        };

        socket.on("game_started", handleGameStarted);

        return () => {
            socket.off("game_started", handleGameStarted);
        };
    }, [socket, isConnected, router, currentUser]);

    const { data: challenges = [], refetch: refetchChallenges } = useQuery<Room[]>({
        queryKey: ['challenges', 'pending'],
        queryFn: () => get('/rooms/challenges/pending'),
        refetchInterval: 10000,
    });

    const sendChallenge = useMutation({
        mutationFn: async ({ challengedId, difficulty }: { challengedId: number; difficulty: string }) => {
            return post<Room>('/rooms/challenge', { challengedId, difficulty });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            queryClient.invalidateQueries({ queryKey: ['challenges', 'pending'] });
        },
    });

    const acceptChallenge = useMutation({
        mutationFn: async (roomId: number) => {
            return post<Room>(`/rooms/challenge/${roomId}/accept`, { roomId });
        },
        onSuccess: (room) => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            queryClient.invalidateQueries({ queryKey: ['challenges', 'pending'] });
            if (room?.id) {
                router.push(`/game?roomId=${room.id}`);
            }
        },
    });

    const rejectChallenge = useMutation({
        mutationFn: async (roomId: number) => {
            return post<Room>(`/rooms/challenge/${roomId}/reject`, { roomId });
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
