import { useMutation, useQueryClient } from "@tanstack/react-query";
import { post } from "./api";
import { useSocket } from "./socket";
import { useRouter } from "expo-router";
import { useContext, useEffect } from "react";
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
    const { socket, isConnected, error } = useSocket();
    const router = useRouter();
    const { room, setRoom } = useContext(RoomContext);

    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleRoom = (data: Room) => {
            if (!data) return;
            setRoom(data);
        };

        const handleGameStarted = (data: { message: string, room: Room }) => {
            console.log("Game started:", data.message);
            router.push(`/game?roomId=${data.room.id}`);
            setRoom(data.room);
        };

        socket.on("room", handleRoom);
        socket.on("game_started", handleGameStarted);

        if (!room && roomId) {
            refresh(roomId);
        }

        return () => {
            socket.off("room", handleRoom);
            socket.off("game_started", handleGameStarted);
        };
    }, [socket, isConnected, roomId]);

    useEffect(() => {
        if (isConnected && roomId && !room) {
            console.log("Attempting to rejoin room after reconnection:", roomId);
            refresh(roomId);
        }
    }, [isConnected, roomId, room]);

    const guess = (roomId: number, coordinates: { x: number; y: number }, guess: string) => {
        if (!socket || !isConnected) {
            console.error("Socket not connected");
            return;
        }
        socket.emit("guess", JSON.stringify({ roomId, x: coordinates.x, y: coordinates.y, guess }));
    };

    const refresh = (roomId: number) => {
        if (!socket || !isConnected) {
            console.error("Socket not connected");
            return;
        }
        socket.emit("loadRoom", JSON.stringify({ roomId }));
    };

    const forfeit = (roomId: number) => {
        if (!socket || !isConnected) {
            console.error("Socket not connected");
            return;
        }
        socket.emit("forfeit", JSON.stringify({ roomId }));
        queryClient.invalidateQueries({ queryKey: ['activeRooms'] });
        queryClient.invalidateQueries({ queryKey: ['room'] });
    };

    return {
        room,
        guess,
        refresh,
        forfeit,
        isConnected,
        error
    };
};
