import { createContext, ReactNode, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { AppState } from 'react-native';
import io, { Socket } from 'socket.io-client';
import { config } from "../config/config";
import { secureStorage } from './storageApi';
import { useMutation, useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Room } from './useJoinRoom';
import { useUser } from './users';
import { get, post, refreshToken } from './api';
import { showToast } from '~/components/shared/Toast';
import { useCancellationStore } from './useCancellationStore';

type ConnectionQuality = 'good' | 'poor' | 'disconnected';

type EmitWithAckOptions = {
  timeout?: number;
  retries?: number;
};

type SocketContextValue = {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  connectionQuality: ConnectionQuality;
  // Fire-and-forget; socket.io buffers while disconnected and flushes on reconnect
  emit: (event: string, data?: unknown) => void;
  // Request/response that survives reconnects by retrying until acknowledged
  emitWithAck: <T = any>(event: string, data?: unknown, options?: EmitWithAckOptions) => Promise<T>;
  connect: () => void;
  disconnect: () => void;
};

const POOR_LATENCY_MS = 200;
const AUTH_RETRY_DELAY_MS = 2000;

export const roomQueryKey = (roomId: number) => ['room', roomId] as const;

const createSocketInstance = (token: string) =>
  io(config.api.socketURL, {
    auth: { authToken: token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0.5,
    timeout: 10000,
    transports: ['websocket'],
    autoConnect: false,
  });

const isAuthError = (error: Error & { data?: { code?: string } }) =>
  error?.message === 'auth/invalid-token' || error?.data?.code === 'auth/invalid-token';

const SocketContext = createContext<SocketContextValue | null>(null);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>('disconnected');
  const { data: user } = useUser();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const latencyHistory = useRef<number[]>([]);

  // Creates the socket once and afterwards only refreshes its credentials.
  // Never tears down a live connection.
  const ensureSocket = useCallback(async () => {
    const token = await secureStorage.get("token");

    if (!token) {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    if (!socketRef.current) {
      socketRef.current = createSocketInstance(token);
      setSocket(socketRef.current);
    } else {
      socketRef.current.auth = { authToken: token };
    }

    // `active` covers both connected and auto-reconnecting states
    if (!socketRef.current.active) {
      setIsConnecting(true);
      socketRef.current.connect();
    }
  }, []);

  useEffect(() => {
    ensureSocket();
  }, [user, ensureSocket]);

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe(({ type, query }) => {
      if (type === 'updated' && query.queryKey[0] === 'me') {
        ensureSocket();
      }
    });
    return unsubscribe;
  }, [queryClient, ensureSocket]);

  // Mobile OSes drop sockets in the background; reconnect as soon as we're back
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        ensureSocket();
      }
    });
    return () => subscription.remove();
  }, [ensureSocket]);

  useEffect(() => {
    if (!socket) return;

    let authRetryTimer: ReturnType<typeof setTimeout> | undefined;

    const handleConnect = () => {
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
      setConnectionQuality('good');
    };

    const handleDisconnect = (reason: Socket.DisconnectReason) => {
      setIsConnected(false);
      setConnectionQuality('disconnected');
      // The built-in manager does not reconnect after a server-initiated disconnect
      if (reason === 'io server disconnect') {
        setIsConnecting(true);
        socket.connect();
      } else if (reason !== 'io client disconnect') {
        setIsConnecting(true);
      }
    };

    const handleConnectError = async (err: Error & { data?: { code?: string } }) => {
      setError(err);
      if (socket.active) {
        // Transport-level failure; the manager is already retrying with backoff
        return;
      }
      setIsConnecting(false);
      // Rejected by the server's auth middleware; refresh credentials and retry
      if (isAuthError(err)) {
        try {
          const token = await refreshToken();
          socket.auth = { authToken: token };
        } catch {
          setError(new Error("Session expired, please sign in again."));
          return;
        }
      }
      clearTimeout(authRetryTimer);
      authRetryTimer = setTimeout(() => {
        if (!socket.active) {
          setIsConnecting(true);
          socket.connect();
        }
      }, AUTH_RETRY_DELAY_MS);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      clearTimeout(authRetryTimer);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const checkLatency = setInterval(() => {
      const start = Date.now();
      socket.timeout(5000).emit('ping', (err: Error | null) => {
        if (err) {
          setConnectionQuality('poor');
          return;
        }
        latencyHistory.current.push(Date.now() - start);
        if (latencyHistory.current.length > 10) {
          latencyHistory.current.shift();
        }
        const avgLatency = latencyHistory.current.reduce((a, b) => a + b, 0) / latencyHistory.current.length;
        setConnectionQuality(avgLatency > POOR_LATENCY_MS ? 'poor' : 'good');
      });
    }, 5000);

    const heartbeat = setInterval(() => {
      socket.emit('heartbeat');
    }, 15000);

    return () => {
      clearInterval(checkLatency);
      clearInterval(heartbeat);
    };
  }, [socket, isConnected]);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const emitWithAck = useCallback(async <T,>(
    event: string,
    data?: unknown,
    { timeout = 5000, retries = 3 }: EmitWithAckOptions = {},
  ): Promise<T> => {
    let lastError: unknown = new Error('Socket unavailable');
    for (let attempt = 0; attempt <= retries; attempt++) {
      const current = socketRef.current;
      if (!current) {
        throw lastError;
      }
      try {
        await waitForConnection(current, timeout);
        return await current.timeout(timeout).emitWithAck(event, data);
      } catch (err) {
        lastError = err;
        await delay(Math.min(500 * 2 ** attempt, 5000));
      }
    }
    throw lastError;
  }, []);

  const value = useMemo<SocketContextValue>(() => ({
    socket,
    isConnected,
    isConnecting,
    error,
    connectionQuality,
    emit,
    emitWithAck,
    connect: () => {
      if (socketRef.current && !socketRef.current.active) {
        socketRef.current.connect();
      }
    },
    disconnect: () => socketRef.current?.disconnect(),
  }), [socket, isConnected, isConnecting, error, connectionQuality, emit, emitWithAck]);

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForConnection = (socket: Socket, timeout: number) =>
  new Promise<void>((resolve, reject) => {
    if (socket.connected) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      socket.off('connect', onConnect);
      reject(new Error('Timed out waiting for socket connection'));
    }, timeout);
    const onConnect = () => {
      clearTimeout(timer);
      resolve();
    };
    socket.once('connect', onConnect);
  });

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

type RoomEventsContextValue = {
  navigateToGame: (roomId: number, options?: { replace?: boolean }) => void;
  registerGameScreen: (roomId: number) => () => void;
};

const RoomEventsContext = createContext<RoomEventsContextValue | null>(null);

const invalidateRoomLists = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ['rooms'] });
};

/**
 * The single owner of room-related socket events. Every room update lands in
 * the react-query cache under ['room', id], so any number of screens can read
 * any number of rooms without overwriting each other.
 */
export const RoomProvider = ({ children }: { children: ReactNode }) => {
  const { socket, emitWithAck } = useSocket();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: currentUser } = useUser();
  const { queueCancellation } = useCancellationStore();
  const openGameScreens = useRef(new Map<number, number>());
  const lastNavigation = useRef<{ roomId: number; at: number } | null>(null);
  const currentUserIdRef = useRef<number | undefined>(currentUser?.id);
  currentUserIdRef.current = currentUser?.id;

  const registerGameScreen = useCallback((roomId: number) => {
    const screens = openGameScreens.current;
    screens.set(roomId, (screens.get(roomId) ?? 0) + 1);
    return () => {
      const count = (screens.get(roomId) ?? 1) - 1;
      if (count <= 0) screens.delete(roomId);
      else screens.set(roomId, count);
    };
  }, []);

  const navigateToGame = useCallback((roomId: number, options: { replace?: boolean } = {}) => {
    if (openGameScreens.current.has(roomId)) return;
    const last = lastNavigation.current;
    if (last && last.roomId === roomId && Date.now() - last.at < 3000) return;
    lastNavigation.current = { roomId, at: Date.now() };

    // Swap out another game's screen rather than stacking games on top of each other
    if (options.replace || openGameScreens.current.size > 0) {
      router.replace(`/game?roomId=${roomId}`);
    } else {
      router.push(`/game?roomId=${roomId}`);
    }
  }, [router]);

  const setRoom = useCallback((room: Room) => {
    queryClient.setQueryData<Room>(roomQueryKey(room.id), room);
  }, [queryClient]);

  useEffect(() => {
    if (!socket) return;

    const isParticipant = (room: Room) => {
      const userId = currentUserIdRef.current;
      return !userId || room.players?.some((player) => player.id === userId);
    };

    const handleRoom = (room: Room & { revealedLetterIndex?: number }) => {
      if (!room?.id) return;
      setRoom(room);
      if (room.status === 'finished') {
        queryClient.invalidateQueries({ queryKey: ['me'] });
        queryClient.invalidateQueries({ queryKey: ['userGameStats'] });
        queryClient.invalidateQueries({ queryKey: ['recentGames'] });
        invalidateRoomLists(queryClient);
      }
    };

    const handleGameStarted = (data: { room: Room }) => {
      if (!data?.room || !isParticipant(data.room)) return;
      setRoom(data.room);
      invalidateRoomLists(queryClient);
      navigateToGame(data.room.id);
    };

    const handleGameForfeited = (data: { room: Room }) => {
      if (!data?.room) return;
      setRoom(data.room);
      invalidateRoomLists(queryClient);
    };

    const handleRatingChange = () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    };

    const handleRoomCancelled = (data: { message?: string }) => {
      invalidateRoomLists(queryClient);
      showToast('error', data?.message || 'Game was cancelled due to inactivity. Please try again later');
    };

    const handleGameCancelled = (data: { message?: string; roomId?: number }) => {
      const cancelledRoomId = data?.roomId !== undefined ? Number(data.roomId) : null;
      const message = data?.message || 'Game cancelled';
      showToast('info', message);
      if (cancelledRoomId !== null) {
        queryClient.setQueryData<Room>(roomQueryKey(cancelledRoomId), (existing) =>
          existing ? { ...existing, status: 'cancelled' } : existing
        );
        queueCancellation(cancelledRoomId, message);
      }
      invalidateRoomLists(queryClient);
    };

    // A reconnect the server could not recover from means events may have been
    // missed: pull fresh state for every room we know about
    const handleConnect = async () => {
      if (socket.recovered) return;
      try {
        const { rooms } = await emitWithAck<{ rooms?: Room[] }>('rooms:active', {});
        rooms?.forEach(setRoom);
      } catch (err) {
        console.warn('Failed to resync active rooms', err);
      }
      invalidateRoomLists(queryClient);
      queryClient.invalidateQueries({ queryKey: ['room'] });
    };

    socket.on("connect", handleConnect);
    socket.on("room", handleRoom);
    socket.on("game_started", handleGameStarted);
    socket.on("game_forfeited", handleGameForfeited);
    socket.on("rating_change", handleRatingChange);
    socket.on("room_cancelled", handleRoomCancelled);
    socket.on("game_cancelled", handleGameCancelled);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("room", handleRoom);
      socket.off("game_started", handleGameStarted);
      socket.off("game_forfeited", handleGameForfeited);
      socket.off("rating_change", handleRatingChange);
      socket.off("room_cancelled", handleRoomCancelled);
      socket.off("game_cancelled", handleGameCancelled);
    };
  }, [socket, queryClient, setRoom, navigateToGame, queueCancellation, emitWithAck]);

  const value = useMemo(() => ({ navigateToGame, registerGameScreen }), [navigateToGame, registerGameScreen]);

  return (
    <RoomEventsContext.Provider value={value}>
      {children}
    </RoomEventsContext.Provider>
  );
};

export const useRoomEvents = () => {
  const context = useContext(RoomEventsContext);
  if (!context) {
    throw new Error('useRoomEvents must be used within a RoomProvider');
  }
  return context;
};

export const useErrors = () => {
  const { socket } = useSocket();
  const [errors, setErrors] = useState<any[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handleError = (data: any) => {
      setErrors((prev) => [...prev, data]);
    };
    socket.on("error", handleError);

    return () => {
      socket.off("error", handleError);
    };
  }, [socket]);

  return { errors };
};

export const useMessages = () => {
  const { socket, emit } = useSocket();
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (data: string) => {
      setMessages((prev) => [...prev, data]);
    };
    socket.on("message", handleMessage);

    return () => {
      socket.off("message", handleMessage);
    };
  }, [socket]);

  const send = (message: string) => {
    emit("message", { message });
  };

  return { messages, send };
};

type QueuedGuess = { roomId: number; x: number; y: number; guess: string; guessId: string };

let guessCounter = 0;
// Only needs to be unique per room within the server's dedupe window
const createGuessId = () =>
  `${Date.now().toString(36)}-${(guessCounter++).toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

type GuessAck = { success: boolean; duplicate?: boolean; error?: string };

const fetchRoom = async (
  roomId: number,
  emitWithAck: SocketContextValue['emitWithAck'],
): Promise<Room> => {
  try {
    const response = await emitWithAck<{ room?: Room; error?: string }>(
      'room:sync',
      { roomId },
      { timeout: 4000, retries: 1 },
    );
    if (response?.room) return response.room;
    if (response?.error === 'Room not found') {
      throw new Error(response.error);
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'Room not found') throw err;
  }
  // Socket unavailable or slow: fall back to HTTP. The socket rejoins the room
  // channel on its next successful connect.
  return get<Room>(`/rooms/${roomId}`);
};

export const useRoom = (roomId?: number) => {
  const queryClient = useQueryClient();
  const { socket, isConnected, error, emitWithAck } = useSocket();
  const router = useRouter();
  const [summaryDismissed, setSummaryDismissed] = useState(false);
  const [revealedLetterIndex, setRevealedLetterIndex] = useState<number | undefined>(undefined);
  const hasRoomId = roomId !== undefined && !Number.isNaN(roomId);

  const roomQuery = useQuery({
    queryKey: roomQueryKey(roomId ?? -1),
    queryFn: () => fetchRoom(roomId!, emitWithAck),
    enabled: hasRoomId,
    // Socket events keep the cache current; refetch only on resync/remount
    staleTime: Infinity,
    retry: (failureCount, err) =>
      !(err instanceof Error && err.message === 'Room not found') && failureCount < 8,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  const room = (roomQuery.data as (Room & { revealedLetterIndex?: number }) | undefined) ?? null;

  // Only auto-reveal updates carry the index; keep it across ordinary updates
  useEffect(() => {
    if (room?.revealedLetterIndex !== undefined) {
      setRevealedLetterIndex(room.revealedLetterIndex);
    }
  }, [room]);

  // Guesses are applied in order, each with a stable id so a retry after a
  // reconnect can never be applied twice.
  const guessQueue = useRef<QueuedGuess[]>([]);
  const isProcessingGuess = useRef(false);

  const processGuessQueue = useCallback(async () => {
    if (isProcessingGuess.current) return;
    isProcessingGuess.current = true;
    try {
      while (guessQueue.current.length > 0) {
        const next = guessQueue.current[0];
        let ack: GuessAck;
        try {
          ack = await emitWithAck<GuessAck>('guess', next, { timeout: 5000, retries: 5 });
        } catch (err) {
          // Still offline after retries; keep the guess and resume on reconnect
          console.warn('Guess not acknowledged yet, will retry on reconnect', err);
          return;
        }
        guessQueue.current.shift();
        if (!ack?.success) {
          console.warn('Guess rejected by server:', next, ack?.error);
        }
      }
    } finally {
      isProcessingGuess.current = false;
    }
  }, [emitWithAck]);

  useEffect(() => {
    if (isConnected && guessQueue.current.length > 0) {
      processGuessQueue();
    }
  }, [isConnected, processGuessQueue]);

  useEffect(() => {
    if (!socket || !hasRoomId) return;

    // The server sends this to the room channel without a room id
    const handleGameInactive = (data: { message?: string; revealedLetter?: { index: number } }) => {
      if (data.message) showToast('info', data.message);
      if (data.revealedLetter) setRevealedLetterIndex(data.revealedLetter.index);
    };

    socket.on("game_inactive", handleGameInactive);
    return () => {
      socket.off("game_inactive", handleGameInactive);
    };
  }, [socket, hasRoomId]);

  const guess = useCallback((targetRoomId: number, coordinates: { x: number; y: number }, letter: string) => {
    guessQueue.current.push({
      roomId: targetRoomId,
      x: coordinates.x,
      y: coordinates.y,
      guess: letter,
      guessId: createGuessId(),
    });
    processGuessQueue();
  }, [processGuessQueue]);

  const refresh = useCallback(() => {
    if (hasRoomId) {
      queryClient.invalidateQueries({ queryKey: roomQueryKey(roomId!) });
    }
  }, [queryClient, hasRoomId, roomId]);

  const forfeit = useCallback((targetRoomId: number) => {
    emitWithAck('forfeit', { roomId: targetRoomId }).catch((err) => {
      console.warn('Forfeit failed', err);
      showToast('error', 'Could not forfeit the game. Please try again.');
    });
  }, [emitWithAck]);

  const cancel = useMutation({
    mutationFn: async (cancelRoomId: number) => {
      return await post(`/rooms/${cancelRoomId}/cancel`, { roomId: cancelRoomId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    }
  });

  const clearRoomState = useCallback(() => {
    if (hasRoomId) {
      queryClient.removeQueries({ queryKey: roomQueryKey(roomId!) });
    }
  }, [queryClient, hasRoomId, roomId]);

  const handleGameSummaryClose = () => {
    setSummaryDismissed(true);
    router.push('/(root)/(tabs)');
  };

  return {
    room,
    isLoadingRoom: roomQuery.isPending,
    roomError: roomQuery.error,
    guess,
    refresh,
    forfeit,
    isConnected,
    error,
    cancel,
    showGameSummary: !summaryDismissed,
    onGameSummaryClose: handleGameSummaryClose,
    revealedLetterIndex,
    clearRoomState,
  };
};

export const useUserStatus = () => {
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handleStatusChange = (data: { userId: number; status: 'online' | 'offline' }) => {
      const applyStatus = <T extends { id: number; status?: 'online' | 'offline' }>(user: T): T =>
        user.id === data.userId ? { ...user, status: data.status } : user;

      queryClient.setQueryData(['me'], (oldData: any) => {
        if (oldData?.id === data.userId) {
          return { ...oldData, status: data.status };
        }
        return oldData;
      });

      queryClient.setQueryData(['users'], (oldData: any[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map((user: any) => applyStatus(user));
      });

      queryClient.setQueryData(['friends'], (oldData: any[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map((friendship: any) => ({
          ...friendship,
          sender: applyStatus(friendship.sender),
          receiver: applyStatus(friendship.receiver),
        }));
      });
    };

    socket.on('user_status_change', handleStatusChange);

    return () => {
      socket.off('user_status_change', handleStatusChange);
    };
  }, [socket, queryClient]);
};
