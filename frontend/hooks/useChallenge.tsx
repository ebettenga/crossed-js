import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { post, get } from "./api";
import { useRoomEvents, useSocket } from "./socket";
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Room } from "./useJoinRoom";
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
    const { socket } = useSocket();
    const [incomingChallenge, setIncomingChallenge] = useState<IncomingChallengePayload | null>(null);
    const { notification } = useHaptics();

    const clearIncomingChallenge = useCallback(() => setIncomingChallenge(null), []);
    const invalidateChallengeRelatedQueries = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['rooms'] });
        queryClient.invalidateQueries({ queryKey: ['challenges', 'pending'] });
    }, [queryClient]);

    useEffect(() => {
        if (!socket) return;

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
    }, [socket, invalidateChallengeRelatedQueries, notification]);

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
    const { navigateToGame } = useRoomEvents();
    const { incomingChallenge, clearIncomingChallenge } = useChallengeEvents();

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
                navigateToGame(room.id);
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
