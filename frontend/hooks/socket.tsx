import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { config } from "../config/config";
import { secureStorage } from './storageApi';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Room } from './useRoom';
import { useUser } from './users';

// Create a function to get a new socket instance with the current token
const createSocketInstance = (token: string) => {
  const socket = io(config.api.socketURL, {
    auth: { authToken: token },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });
  return socket;
};

export const SocketContext = createContext<Socket | null>(null);

interface RoomContextType {
  room: Room | null;
  setRoom: (room: Room | null) => void;
}

export const RoomContext = createContext<RoomContextType>({
  room: null,
  setRoom: () => {},
});

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { data: user } = useUser();
  const queryClient = useQueryClient();

  // Initialize socket when user is authenticated
  useEffect(() => {
    const initializeSocket = async () => {
      const token = await secureStorage.get("token");
      
      // Only create socket if we have a token and user
      if (token && user) {
        const newSocket = createSocketInstance(token);

        newSocket.on("connect", () => {
          console.log("Socket connected");
        });

        newSocket.on("connect_error", (error) => {
          console.error("Socket connection error:", error);
        });

        newSocket.on("disconnect", (reason) => {
          console.log("Socket disconnected:", reason);
          if (reason === "io server disconnect") {
            // Server initiated disconnect, try to reconnect
            newSocket.connect();
          }
        });

        setSocket(newSocket);
        return newSocket;
      } else {
        // If no token or user, disconnect existing socket
        if (socket) {
          socket.disconnect();
          setSocket(null);
        }
        return null;
      }
    };

    const cleanup = async () => {
      const currentSocket = await initializeSocket();
      return () => {
        if (currentSocket) {
          currentSocket.disconnect();
        }
      };
    };

    cleanup();
  }, [user]); // Reinitialize socket when user changes

  // Handle token refresh
  useEffect(() => {
    const handleTokenRefresh = async () => {
      const token = await secureStorage.get("token");
      if (socket && token) {
        socket.auth = { authToken: token };
        socket.disconnect().connect();
      }
    };

    // Listen for token changes through React Query cache
    const unsubscribe = queryClient.getQueryCache().subscribe(({ type, query }) => {
      if (type === 'updated' && query.queryKey[0] === 'me') {
        handleTokenRefresh();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [socket, queryClient]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};

export const RoomProvider = ({ children }: { children: ReactNode }) => {
  const [room, setRoom] = useState<Room | null>(null);
  
  return (
    <RoomContext.Provider value={{ room, setRoom }}>
      {children}
    </RoomContext.Provider>
  );
};

export const useSocket = () => {
  const socket = useContext(SocketContext);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const messageQueue = useRef<Array<{ event: string; data: any }>>([]);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const emitSafely = (event: string, data: any) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    } else {
      messageQueue.current.push({ event, data });
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      console.log("Socket connected, processing queued messages");
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
      reconnectAttempts.current = 0;

      // Process queued messages
      while (messageQueue.current.length > 0) {
        const message = messageQueue.current.shift();
        if (message) {
          socket.emit(message.event, message.data);
        }
      }
    };

    const handleDisconnect = (reason: string) => {
      console.log("Socket disconnected:", reason);
      setIsConnected(false);
      setError(new Error(`Disconnected: ${reason}`));

      // Attempt to reconnect if it wasn't a clean disconnect
      if (reason !== "io client disconnect" && reconnectAttempts.current < maxReconnectAttempts) {
        setIsConnecting(true);
        reconnectAttempts.current++;
        setTimeout(() => {
          socket.connect();
        }, Math.min(1000 * reconnectAttempts.current, 5000)); // Exponential backoff
      }
    };

    const handleConnectError = (error: Error) => {
      console.error("Socket connection error:", error);
      setIsConnecting(false);
      setError(error);
    };

    const handleReconnecting = (attemptNumber: number) => {
      console.log(`Reconnecting... Attempt ${attemptNumber}`);
      setIsConnecting(true);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("reconnecting", handleReconnecting);

    // Initial connection
    if (!socket.connected) {
      setIsConnecting(true);
      socket.connect();
    } else {
      setIsConnected(true);
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("reconnecting", handleReconnecting);
    };
  }, [socket]);

  return {
    socket,
    isConnected,
    isConnecting,
    error,
    connect: () => socket?.connect(),
    disconnect: () => socket?.disconnect(),
    emit: emitSafely
  };
};

export const useErrors = () => {
  const { socket } = useSocket();
  const [errors, setErrors] = useState<any[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.on("error", (data: any) => {
      setErrors((prev) => [...prev, data]);
    });

    return () => {
      socket.off("error");
    };
  }, [socket]);

  return { errors };
};

export const useMessages = () => {
  const { socket } = useSocket();
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.on("message", (data) => {
      console.log("Received message", data);
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      socket.off("message");
    };
  }, [socket]);

  const send = (message: string) => {
    if (!socket) return;
    socket.emit("message", JSON.stringify({ message }));
  };

  return { messages, send };
};

export const useRoom = (roomId?: number) => {
  const queryClient = useQueryClient();
  const { socket, isConnected, error, emit } = useSocket();
  const router = useRouter();
  const { room, setRoom } = useContext(RoomContext);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isConnected) {
      if (isInitialized) {
        console.log("Socket disconnected, waiting for reconnection...");
      }
      return;
    }

    const handleRoom = (data: Room) => {
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

    socket?.on("room", handleRoom);
    socket?.on("game_started", handleGameStarted);

    // Only refresh if we haven't initialized the room yet
    if (!isInitialized && roomId) {
      console.log("Initializing room:", roomId);
      refresh(roomId);
    }

    return () => {
      socket?.off("room", handleRoom);
      socket?.off("game_started", handleGameStarted);
    };
  }, [socket, isConnected, roomId, isInitialized]);

  const guess = (roomId: number, coordinates: { x: number; y: number }, guess: string) => {
    emit("guess", JSON.stringify({ roomId, x: coordinates.x, y: coordinates.y, guess }));
  };

  const refresh = (roomId: number) => {
    emit("loadRoom", JSON.stringify({ roomId }));
  };

  const forfeit = (roomId: number) => {
    emit("forfeit", JSON.stringify({ roomId }));
    queryClient.invalidateQueries({ queryKey: ['activeRooms'] });
    queryClient.invalidateQueries({ queryKey: ['room'] });
  };

  return { 
    room, 
    guess, 
    refresh, 
    forfeit,
    isConnected,
    error,
    isInitialized
  };
};




