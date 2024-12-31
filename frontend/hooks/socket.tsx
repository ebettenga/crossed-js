import { createContext, JSXElementConstructor, ReactElement, ReactNode, ReactPortal, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { config } from "../config/config";

type Player = {
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
  players: Player[];
};


const socketInstance = io(config.api.socketURL);
socketInstance.auth = { authToken: "token" } //storage.getString("token") }
export const SocketContext = createContext(socketInstance);


export const SocketProvider = (props: { children: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined; }) => (
  <SocketContext.Provider value={socketInstance}>{props.children}</SocketContext.Provider>
);


export const useSocket = () => {
  const socket = useContext(SocketContext);

  if (!socket.connected) {
    socket.connect();
  }

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

  return errors;
}


export const useMessages = () => {
  const socket = useSocket();
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    socket.on("message", (data) => {
      setMessages((prev) => [...prev, data])
    })
  }, [socket])


  const send = (message: string) => {
    socket.send(JSON.stringify({ message }))
  }

  return { messages, send };
}


export const useRoom = ({ roomId }: { roomId: number }) => {
  const socket = useSocket();
  const [room, setRoom] = useState<Room | null>(null);

  useEffect(() => {
    socket.on("room", (data: Room) => {
      if (!data) {
        return;
      }
      setRoom(data);
    });
  }, [socket]);

  const guess = (coordinates: { x: number; y: number }, guess: string) => {
    socket.emit("guess", JSON.stringify({ roomId, x: coordinates.x, y: coordinates.y, guess }));

  };

  const refresh = () => {
    socket.emit("loadRoom", JSON.stringify({ roomId }));
  };

  return { room, guess, refresh };
}