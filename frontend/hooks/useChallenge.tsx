import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { post, get } from "./api";
import { useSocket } from "./socket";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Room } from "./useJoinRoom";
import { useRouter } from "expo-router";
import { useUser } from "./users";
import { useHaptics } from "./useHaptics";

export const CHALLENGES_UPDATED_EVENT = 'challenges:updated';

type IncomingChallengePayload = {
    room: Room;
    challenger: {
        id: number;
        username: string;
    };
    context?: string;
};

type ChallengeEventsContextValue = {
    incomingChallenge: IncomingChallengePayload | null;
    clearIncomingChallenge: () => void;
    setIncomingChallenge: (challenge: IncomingChallengePayload | null) => void;
};

const ChallengeEventsContext = React.createContext<ChallengeEventsContextValue | undefined>(undefined);

export const ChallengeProvider = ({ children }: { children: React.ReactNode }) => {
    const queryClient = useQueryClient();
    const { socket, isConnected } = useSocket();
    const [incomingChallenge, setIncomingChallenge] = useState<IncomingChallengePayload | null>(null);
    const { notification } = useHaptics();

    const clearIncomingChallenge = useCallback(() => setIncomingChallenge(null), []);
    const invalidateChallengeRelatedQueries = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['rooms'] });
        queryClient.invalidateQueries({ queryKey: ['challenges', 'pending'] });
    }, [queryClient]);

    useEffect(() => {
        if (!isConnected || !socket) return;

        const handleChallengeReceived = (data: IncomingChallengePayload) => {
            setIncomingChallenge(data);
            invalidateChallengeRelatedQueries();
            notification();
        };

        const handleChallengesUpdated = () => {
            invalidateChallengeRelatedQueries();
        };

        socket.on("challenge_received", handleChallengeReceived);
        socket.on(CHALLENGES_UPDATED_EVENT, handleChallengesUpdated);

        return () => {
            socket.off("challenge_received", handleChallengeReceived);
            socket.off(CHALLENGES_UPDATED_EVENT, handleChallengesUpdated);
        };
    }, [socket, isConnected, invalidateChallengeRelatedQueries, notification]);

    const value = useMemo(() => ({
        incomingChallenge,
        clearIncomingChallenge,
        setIncomingChallenge,
    }), [incomingChallenge, clearIncomingChallenge]);

    return (
        <ChallengeEventsContext.Provider value={value}>
            {children}
        </ChallengeEventsContext.Provider>
    );
};

export const useChallengeEvents = () => {
    const context = useContext(ChallengeEventsContext);
    if (!context) {
        throw new Error('useChallengeEvents must be used within a ChallengeProvider');
    }
    return context;
};

export const useChallenge = () => {
    const queryClient = useQueryClient();
    const { socket, isConnected } = useSocket();
    const router = useRouter();
    const { data: currentUser } = useUser();
    const { incomingChallenge, clearIncomingChallenge } = useChallengeEvents();

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
        mutationFn: async ({ challengedId, difficulty, context }: { challengedId: number; difficulty: string; context?: string }) => {
            return post<Room>('/rooms/challenge', { challengedId, difficulty, context });
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
        incomingChallenge,
        clearIncomingChallenge,
    };
};
