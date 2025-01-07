import { useMutation, useQueryClient } from "@tanstack/react-query";
import { post } from "./api";
import { useSocket } from "./socket";
import { useRouter } from "expo-router";
import { useContext, useEffect, useRef, useCallback, useState } from "react";
import { RoomContext } from "./socket";

export enum SquareType {
    SOLVED,
    BLANK,
    BLACK,
    CIRCLE_BLANK,
    CIRCLE_SOLVED,
}

export interface Square {
    id: number;
    squareType: SquareType;
    letter?: string;
    gridnumber: number | null;
    x: number;
    y: number;
    downQuestion?: string;
    acrossQuestion?: string;
}

export type Player = {
    id: number;
    username: string;
    score: number;
};

export type Room = {
    id: number;
    created_at: string;
    completed_at?: string;
    difficulty: string;
    type: '1v1' | '2v2' | 'free4all';
    status: 'playing' | 'pending' | 'finished' | 'cancelled';
    player_count: number;
    players: Player[];
    scores: { [key: number]: number };
    crossword: {
        col_size: number;
        row_size: number;
        gridnums: number[];
        clues: {
            across: string[];
            down: string[];
        };
        title: string;
        author: string;
    };
    found_letters: string[];
    board: Square[][];
};

type JoinRoomParams = {
    difficulty: string;
    type: '1v1' | '2v2' | 'free4all';
};

export const useJoinRoom = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (params: JoinRoomParams) => {
            const { data } = await post('/rooms/join', params);
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['rooms', 'playing'] });
            queryClient.invalidateQueries({ queryKey: ['rooms', 'pending'] });
        },
    });
};

export const useRoom = (roomId?: number) => {
    const queryClient = useQueryClient();
    const { socket, isConnected, error, isConnecting } = useSocket();
    const router = useRouter();
    const { room, setRoom } = useContext(RoomContext);
    const [isInitialized, setIsInitialized] = useState(false);
    const lastRoomRef = useRef<Room | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

    // Keep track of the last known room state
    useEffect(() => {
        if (room) {
            lastRoomRef.current = room;
        }
    }, [room]);

    useEffect(() => {
        if (!socket) return;

        const handleRoom = (data: Room | null) => {
            if (!data) return;

            // Check if room status changed to finished
            if (data.status === 'finished' && room?.status !== 'finished') {
                // Invalidate user stats and data
                queryClient.invalidateQueries({ queryKey: ['me'] });
                queryClient.invalidateQueries({ queryKey: ['userGameStats'] });
                queryClient.invalidateQueries({ queryKey: ['recentGames'] });
            }

            setRoom(data);
            setIsInitialized(true);
        };

        const handleGameStarted = (data: { message: string, room: Room }) => {
            console.log("Game started:", data.message);
            router.push(`/game?roomId=${data.room.id}`);
            setRoom(data.room);
        };

        socket.on("room", handleRoom);
        socket.on("game_started", handleGameStarted);

        return () => {
            socket.off("room", handleRoom);
            socket.off("game_started", handleGameStarted);
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [socket]);

    // Handle reconnection
    useEffect(() => {
        if (!roomId) return;

        // Clear any existing reconnection timeout
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }

        if (isConnected && !isConnecting) {
            // If we're connected but don't have room data, try to rejoin
            if (!room || room.id !== roomId) {
                console.log("Attempting to rejoin room after connection:", roomId);
                reconnectTimeoutRef.current = setTimeout(() => {
                    refresh(roomId);
                }, 500); // Small delay to ensure socket is ready
            }
        } else if (!isConnected && lastRoomRef.current) {
            // Reset room state when disconnected
            setRoom(null);
            setIsInitialized(false);
        }
    }, [isConnected, isConnecting, roomId, room]);

    const refresh = useCallback((roomId: number) => {
        if (!socket || !isConnected) {
            console.error("Socket not connected, cannot refresh room");
            return;
        }
        console.log("Refreshing room:", roomId);
        socket.emit("loadRoom", JSON.stringify({ roomId }));
    }, [socket, isConnected]);

    const guess = useCallback((roomId: number, coordinates: { x: number; y: number }, guess: string) => {
        if (!socket || !isConnected) {
            console.error("Socket not connected, cannot make guess");
            return;
        }
        socket.emit("guess", JSON.stringify({ roomId, x: coordinates.x, y: coordinates.y, guess }));
    }, [socket, isConnected]);

    const forfeit = useCallback((roomId: number) => {
        if (!socket || !isConnected) {
            console.error("Socket not connected, cannot forfeit");
            return;
        }
        socket.emit("forfeit", JSON.stringify({ roomId }));
        queryClient.invalidateQueries({ queryKey: ['activeRooms'] });
        queryClient.invalidateQueries({ queryKey: ['room'] });
    }, [socket, isConnected, queryClient]);

    return {
        room,
        guess,
        refresh,
        forfeit,
        isConnected,
        isConnecting,
        error,
        isInitialized
    };
};
