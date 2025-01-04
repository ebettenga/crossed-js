import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { post, get } from "./api";
import { useSocket } from "./socket";
import { useEffect, useState } from "react";
import { Room } from "./useRoom";
import { useRouter } from "expo-router";

type Challenge = {
    room: Room;
    challenger: {
        id: number;
        username: string;
    };
};

export const useChallenge = () => {
    const queryClient = useQueryClient();
    const { socket, isConnected } = useSocket();
    const [pendingChallenges, setPendingChallenges] = useState<Challenge[]>([]);
    const router = useRouter();

    useEffect(() => {
        if (!isConnected || !socket) return;

        const handleChallengeReceived = (challenge: Challenge) => {
            setPendingChallenges(prev => [...prev, challenge]);
        };

        socket.on("challenge_received", handleChallengeReceived);

        return () => {
            socket.off("challenge_received", handleChallengeReceived);
        };
    }, [socket, isConnected]);

    const { data: challenges = [] } = useQuery<Challenge[]>({
        queryKey: ['challenges', 'pending'],
        queryFn: () => get('/rooms/challenges/pending'),
    });

    const sendChallenge = useMutation({
        mutationFn: async ({ challengedId, difficulty }: { challengedId: number; difficulty: string }) => {
            const { data } = await post('/rooms/challenge', { challengedId, difficulty });
            return data as Room;
        },
        onSuccess: (room) => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            queryClient.invalidateQueries({ queryKey: ['challenges'] });
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
            queryClient.invalidateQueries({ queryKey: ['challenges'] });
            setPendingChallenges(prev => prev.filter(c => c.room.id !== room.id));
            router.push(`/game?roomId=${room.id}`);
        },
    });

    const rejectChallenge = useMutation({
        mutationFn: async (roomId: number) => {
            const { data } = await post(`/rooms/challenge/${roomId}/reject`, { roomId });
            return data as Room;
        },
        onSuccess: (room) => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            queryClient.invalidateQueries({ queryKey: ['challenges'] });
            setPendingChallenges(prev => prev.filter(c => c.room.id !== room.id));
        },
    });

    // Combine socket challenges with fetched challenges
    console.log(challenges);
    console.log(pendingChallenges);
    const allChallenges = [...challenges, ...pendingChallenges];

    return {
        pendingChallenges: allChallenges,
        sendChallenge,
        acceptChallenge,
        rejectChallenge,
    };
}; 