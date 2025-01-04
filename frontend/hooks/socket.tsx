import { createContext, JSXElementConstructor, ReactElement, ReactNode, ReactPortal, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { config } from "../config/config";
import { secureStorage } from './storageApi';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Room, Square, SquareType } from './useRoom';

const socketInstance = io(config.api.socketURL);
const token = secureStorage.get("token");
socketInstance.auth = { authToken: token }
export const SocketContext = createContext(socketInstance);

export const SocketProvider = (props: { children: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined; }) => (
  <SocketContext.Provider value={socketInstance}>{props.children}</SocketContext.Provider>
);

export const useSocket = () => {
  const socket = useContext(SocketContext);

  useEffect(() => {
    if (!socket.connected) {
      console.log("Connecting socket")
      socket.connect();
    }
  }, [socket])

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Socket connected")
    })
  }, [])

  return socket;
};

export const useErrors = () => {
  const socket = useSocket();
  const [errors, setErrors] = useState<any[]>([]);

  useEffect(() => {
    socket.on("error", (data: any) => {
      setErrors((prev) => [...prev, data])
    })
  }, [socket])

  return { errors };
}

export const useMessages = () => {
  const socket = useSocket();
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    socket.on("message", (data) => {
      console.log("Received message", data);
      setMessages((prev) => [...prev, data])
    })
  }, [socket])

  const send = (message: string) => {
    socket.emit("message", JSON.stringify({ message }))
  }

  return { messages, send };
}

// Create the room context
const RoomContext = createContext<{
  room: Room | null;
  setRoom: (room: Room | null) => void;
}>({
  room: null,
  setRoom: () => {},
});

// Create a provider component
export const RoomProvider = ({ children }: { children: ReactNode }) => {
  const [room, setRoom] = useState<Room | null>(null);
  
  return (
    <RoomContext.Provider value={{ room, setRoom }}>
      {children}
    </RoomContext.Provider>
  );
};

// Update useRoom to use the context
export const useRoom = (roomId?: number) => {
  const queryClient = useQueryClient();
  const socket = useSocket();
  const router = useRouter();
  const { room, setRoom } = useContext(RoomContext);

  useEffect(() => {
    socket.on("room", (data: Room) => {
      if (!data) return;
      setRoom(data);
    });

    socket.on("game_started", (data: { message: string, room: Room }) => {
      console.log("Game started:", data.message);
      router.push(`/game?roomId=${data.room.id}`);
      setRoom(data.room);
    });

    if (!room && roomId) {
      refresh(roomId);
    }

    return () => {
      socket.off("room");
      socket.off("game_started");
    };
  }, [socket, roomId]);

  const guess = (roomId: number, coordinates: { x: number; y: number }, guess: string) => {
    socket.emit("guess", JSON.stringify({ roomId, x: coordinates.x, y: coordinates.y, guess }));
  };

  const refresh = (roomId: number) => {
    socket.emit("loadRoom", JSON.stringify({ roomId }));
  };

  const forfeit = (roomId: number) => {
    socket.emit("forfeit", JSON.stringify({ roomId }));
    queryClient.invalidateQueries({ queryKey: ['activeRooms'] });
    queryClient.invalidateQueries({ queryKey: ['room'] });
  };

  return { room, guess, refresh, forfeit };
};

export { SquareType, Square };
