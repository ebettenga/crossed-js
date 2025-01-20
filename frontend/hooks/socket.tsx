import { createContext, ReactNode, useContext, useEffect, useRef, useState, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { config } from "../config/config";
import { secureStorage } from './storageApi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Room } from './useJoinRoom';
import { useUser } from './users';
import { post } from './api';
import { showToast } from '~/components/shared/Toast';

// Create a function to get a new socket instance with the current token
const createSocketInstance = (token: string) => {
  const socket = io(config.api.socketURL, {
    auth: { authToken: token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 10000,
    timeout: 10000,
    transports: ['websocket'],
    forceNew: true,
    autoConnect: false,
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
  setRoom: () => { },
});

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  // Initialize socket immediately and maintain connection
  useEffect(() => {
    const initializeSocket = async () => {
      try {
        const token = await secureStorage.get("token");

        // If we already have a socket instance, update its auth token
        if (socketRef.current && token) {
          socketRef.current.auth = { authToken: token };
          if (!socketRef.current.connected) {
            socketRef.current.connect();
          }
          return;
        }

        // Create new socket instance
        const newSocket = createSocketInstance(token || "");

        newSocket.on("connect", () => {
          console.log("Socket connected");
        });

        newSocket.on("connect_error", async (error) => {
          console.error("Socket connection error:", error);
          newSocket.connect();
          // On auth error, try to get a fresh token
          if (error.message?.includes("auth")) {
            const newToken = await secureStorage.get("token");
            if (newToken) {
              newSocket.auth = { authToken: newToken };
              newSocket.connect();
            }
          }
        });

        newSocket.on("disconnect", (reason) => {
          console.log("Socket disconnected:", reason);
          // Always try to reconnect unless explicitly disconnected
          if (reason !== "io client disconnect") {
            newSocket.connect();
          }
        });

        socketRef.current = newSocket;
        setSocket(newSocket);
      } catch (error) {
        console.error("Socket initialization error:", error);
      }
    };

    initializeSocket();
  }, []); // Empty dependency array - only run once on mount

  // Update socket auth when user/token changes
  useEffect(() => {
    const updateSocketAuth = async () => {
      const token = await secureStorage.get("token");
      if (socketRef.current && token) {
        socketRef.current.auth = { authToken: token };
        if (!socketRef.current.connected) {
          socketRef.current.connect();
        }
      }
    };

    if (user) {
      updateSocketAuth();
    }
  }, [user]);

  // Handle token refresh
  useEffect(() => {
    const handleTokenRefresh = async () => {
      const token = await secureStorage.get("token");
      if (socketRef.current && token) {
        socketRef.current.auth = { authToken: token };
        if (!socketRef.current.connected) {
          socketRef.current.connect();
        }
      }
    };

    const unsubscribe = queryClient.getQueryCache().subscribe(({ type, query }) => {
      if (type === 'updated' && query.queryKey[0] === 'me') {
        handleTokenRefresh();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

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
  const reconnectionDelay = useRef(500);
  const maxReconnectionDelay = 10000;
  const maxReconnectAttempts = 50;
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'disconnected'>('good');
  const latencyHistory = useRef<number[]>([]);
  const reconnectTimeout = useRef<NodeJS.Timeout>();
  const heartbeatInterval = useRef<NodeJS.Timeout>();

  const attemptReconnect = useCallback(() => {
    if (!socket || reconnectAttempts.current >= maxReconnectAttempts) return;

    setIsConnecting(true);
    reconnectAttempts.current += 1;

    // Clear any existing timeout
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }

    reconnectTimeout.current = setTimeout(() => {
      console.log(`Reconnection attempt ${reconnectAttempts.current}`);
      socket?.disconnect();
      socket.connect();

      // Exponential backoff with max delay and jitter
      const jitter = Math.random() * 100;
      reconnectionDelay.current = Math.min(
        reconnectionDelay.current * 1.5 + jitter,
        maxReconnectionDelay
      );
    }, reconnectionDelay.current);
  }, [socket]);

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
      reconnectionDelay.current = 500;

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
      setConnectionQuality('disconnected');

      // Attempt to reconnect unless explicitly disconnected
      if (reason !== "io client disconnect" && reconnectAttempts.current < maxReconnectAttempts) {
        attemptReconnect();
      }
    };

    const handleConnectError = (error: Error) => {
      console.error("Socket connection error:", error);
      setError(error);

      // Attempt to reconnect on connection error
      if (reconnectAttempts.current < maxReconnectAttempts) {
        attemptReconnect();
      }
    };

    const handleReconnectFailed = () => {
      console.error("Socket reconnection failed after maximum attempts");
      setIsConnecting(false);
      setError(new Error("Reconnection failed after maximum attempts"));
      setConnectionQuality('disconnected');
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("reconnect_failed", handleReconnectFailed);

    // Initial connection
    if (!socket.connected) {
      setIsConnecting(true);
      socket.connect();
    } else {
      setIsConnected(true);
    }

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("reconnect_failed", handleReconnectFailed);
    };
  }, [socket, attemptReconnect]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const checkLatency = setInterval(() => {
      const start = Date.now();
      socket.emit('ping', () => {
        const latency = Date.now() - start;
        latencyHistory.current.push(latency);

        // Keep last 10 measurements
        if (latencyHistory.current.length > 10) {
          latencyHistory.current.shift();
        }

        // Calculate average latency
        const avgLatency = latencyHistory.current.reduce((a, b) => a + b, 0) / latencyHistory.current.length;

        setConnectionQuality(
          !isConnected ? 'disconnected' :
            avgLatency > 200 ? 'poor' : 'good'
        );
      });
    }, 5000);

    return () => clearInterval(checkLatency);
  }, [socket, isConnected]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    // Start heartbeat
    heartbeatInterval.current = setInterval(() => {
      socket.emit('heartbeat');
    }, 15000); // Send heartbeat every 15 seconds

    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, [socket, isConnected]);

  return {
    socket,
    isConnected,
    isConnecting,
    error,
    connectionQuality,
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
  const { data: currentUser } = useUser();
  const [showGameSummary, setShowGameSummary] = useState(true);

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    const handleRoom = (data: Room) => {
      if (!data) return;

      if (data.status === 'finished') {
        // Invalidate user stats and data
        queryClient.invalidateQueries({ queryKey: ['me'] });
        queryClient.invalidateQueries({ queryKey: ['userGameStats'] });
        queryClient.invalidateQueries({ queryKey: ['recentGames'] });
        setShowGameSummary(true);
      }

      setRoom(data);
      setIsInitialized(true);
    };

    const handleGameStarted = (data: { message: string, room: Room }) => {
      console.log("Game started:", data.message);
      // Only redirect if the current user is a player in this game
      if (currentUser && data.room.players.some(player => player.id === currentUser.id)) {
        router.push(`/game?roomId=${data.room.id}`);
        setRoom(data.room);
      }
    };

    const handleGameForfeited = (data: { message: string, forfeitedBy: number, room: Room }) => {
      console.log("Game forfeited:", data.message);
      setRoom(data.room);

      if (currentUser) {
        // Find the current user's game stats
        const isWinner = data.forfeitedBy !== currentUser.id;
        const userStats = data.room.players.find(p => p.id === currentUser.id);
        const userGameStats = {
          isWinner,
          correctGuesses: 0, // These will be updated when we receive rating_change
          incorrectGuesses: 0,
          eloAtGame: userStats?.eloRating || 0,
          eloChange: 0,
        };
        setShowGameSummary(true);
      }

      // If current user is in the game, prepare for redirection
      if (currentUser && data.room.players.some(player => player.id === currentUser.id)) {
        // Don't redirect immediately, wait for user to close the game summary
        // router.push('/(root)/(tabs)');
      }
    };

    const handleRatingChange = (data: { oldRating: number, newRating: number, change: number }) => {
      if (currentUser) {
        setShowGameSummary(true);
      }
    };

    const handleRoomCancelled = (data: { message: string, roomId: number, reason: string }) => {
      console.log("Room cancelled:", data.message);
      // Invalidate pending rooms query
      queryClient.invalidateQueries({ queryKey: ['rooms', 'pending'] });
      showToast(
        'error',
        'Game was cancelled due to inactivity. Please try again later',
      );

    };

    socket?.on("room", handleRoom);
    socket?.on("game_started", handleGameStarted);
    socket?.on("game_forfeited", handleGameForfeited);
    socket?.on("rating_change", handleRatingChange);
    socket?.on("room_cancelled", handleRoomCancelled);

    // Only refresh if we haven't initialized the room yet
    if (!isInitialized && roomId) {
      console.log("Initializing room:", roomId);
      refresh(roomId);
    }

    return () => {
      socket?.off("room", handleRoom);
      socket?.off("game_started", handleGameStarted);
      socket?.off("game_forfeited", handleGameForfeited);
      socket?.off("rating_change", handleRatingChange);
      socket?.off("room_cancelled", handleRoomCancelled);
    };
  }, [socket, isConnected, roomId, isInitialized, currentUser]);

  const handleGameSummaryClose = () => {
    setShowGameSummary(false);
    router.push('/(root)/(tabs)');
  };

  const guess = (roomId: number, coordinates: { x: number; y: number }, guess: string) => {
    emit("guess", JSON.stringify({ roomId, x: coordinates.x, y: coordinates.y, guess }));
  };

  const refresh = (roomId: number) => {
    emit("loadRoom", JSON.stringify({ roomId }));
  };

  const cancel = useMutation({
    mutationFn: async (roomId: number) => {
      return await post(`/rooms/${roomId}/cancel`, { roomId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    }
  });

  const forfeit = (roomId: number) => {
    emit("forfeit", JSON.stringify({ roomId }));
  };

  return {
    room,
    guess,
    refresh,
    forfeit,
    isConnected,
    error,
    isInitialized,
    cancel,
    showGameSummary,
    onGameSummaryClose: handleGameSummaryClose,
  };
};

export const useUserStatus = () => {
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handleStatusChange = (data: { userId: number; status: 'online' | 'offline' }) => {
      queryClient.setQueryData(['me'], (oldData: any) => {
        if (oldData?.id === data.userId) {
          return { ...oldData, status: data.status };
        }
        return oldData;
      });

      // Update any cached user data
      queryClient.setQueryData(['users'], (oldData: any[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map((user: any) =>
          user.id === data.userId ? { ...user, status: data.status } : user
        );
      });
    };

    socket.on('user_status_change', handleStatusChange);

    return () => {
      socket.off('user_status_change', handleStatusChange);
    };
  }, [socket, queryClient]);
};
