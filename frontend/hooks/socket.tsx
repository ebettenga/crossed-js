import { createContext, JSXElementConstructor, ReactElement, ReactNode, ReactPortal, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { config } from "../config/config";
import { secureStorage } from './storageApi';

export type Player = {
  created_at: string;
  description: string | null;
  email: string;
  id: number;
  roles: string[];
  score: number;
  username: string;
}

type Room = {
  created_at: string;
  crossword: {
    answers: {
      across: string[];
      down: string[];
    };
    author: string;
    circles: any[];
    clues: {
      across: string[];
      down: string[];
    };
    col_size: number;
    date: string;
    dow: string;
    grid: string[];
    gridnums: any[];
    id: number;
    jnote: string;
    notepad: string;
    row_size: number;
    shadecircles: boolean;
    title: string;
  };
  difficulty: string;
  found_letters: string[];
  id: number;
  player_count: number;
  players: Player[];
  scores: {
    [key: string]: number;
  };
  status: 'pending' | 'playing' | 'finished';
  type: '1v1' | '2v2' | 'free4all';
  board: Square[][];
};


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
  const socket = useSocket();
  const { room, setRoom } = useContext(RoomContext);

  const createBoard = (roomData: Room): Square[][] => {
    const board: Square[][] = [];
    const { col_size, row_size, grid, gridnums, clues } = roomData.crossword;
    
    // First create the board structure
    for (let x = 0; x < row_size; x++) {
      board[x] = [];
      for (let y = 0; y < col_size; y++) {
        const index = x * col_size + y;
        const letter = roomData.found_letters[index];
        const gridnumber = gridnums[index] || null;

        let squareType = SquareType.BLANK;
        if (letter === '.') {
          squareType = SquareType.BLACK;
        } else if (roomData.found_letters[index] !== '*') {
          squareType = SquareType.SOLVED;
        }

        board[x][y] = {
          id: index,
          squareType,
          letter,
          gridnumber,
          x,
          y,
          downQuestion: undefined,
          acrossQuestion: undefined,
        };
      }
    }

    // Add across clues
    for (let x = 0; x < row_size; x++) {
      for (let y = 0; y < col_size; y++) {
        const square = board[x][y];
        if (square.squareType === SquareType.BLACK) continue;

        // Look backwards to find the start of this word
        let startY = y;
        while (startY > 0 && board[x][startY - 1].squareType !== SquareType.BLACK) {
          startY--;
        }

        // Get the clue from the starting square
        const startSquare = board[x][startY];
        if (startSquare.gridnumber !== null) {
          square.acrossQuestion = clues.across[startSquare.gridnumber - 1];
        }
      }
    }

    // Add down clues
    for (let y = 0; y < col_size; y++) {
      for (let x = 0; x < row_size; x++) {
        const square = board[x][y];
        if (square.squareType === SquareType.BLACK) continue;

        // Look upwards to find the start of this word
        let startX = x;
        while (startX > 0 && board[startX - 1][y].squareType !== SquareType.BLACK) {
          startX--;
        }

        // Get the clue from the starting square
        const startSquare = board[startX][y];
        if (startSquare.gridnumber !== null) {
          square.downQuestion = clues.down[startSquare.gridnumber - 1];
        }
      }
    }

    return board;
  };

  useEffect(() => {
    socket.on("room", (data: Room) => {
      console.log('received room: ');
      console.log(data);
      if (!data) return;
      const boardData = createBoard(data);
      setRoom({ ...data, board: boardData });
    });

    if (!room && roomId) {
      refresh(roomId);
    }

    return () => {
      socket.off("room");
    };
  }, [socket, roomId]);

  const guess = (roomId: number, coordinates: { x: number; y: number }, guess: string) => {
    socket.emit("guess", JSON.stringify({ roomId, x: coordinates.x, y: coordinates.y, guess }));
  };

  const refresh = (roomId: number) => {
    socket.emit("loadRoom", JSON.stringify({ roomId }));
  };

  return { room, guess, refresh };
};