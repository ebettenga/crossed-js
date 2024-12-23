import { FastifyInstance } from "fastify";
import { RoomService } from "../../services/RoomService"; // Assuming room_service is exported from RoomService
import { AuthService } from "../../services/AuthService";
import { User } from "../../entities/User";

export type Guess = {
  roomId: number;
  x: number;
  y: number;
  guess: string;
};
type GuessSocketRequest = Guess & SocketRequest;

export type JoinRoom = {
  difficulty: string;
};

export type Message = {
  message: string;
};
type MessageSocketRequest = Message & SocketRequest;

export type RoomMessage = {
  roomId: number;
} & MessageSocketRequest;

export type LoadRoom = {
  roomId: number;
};
type LoadRoomSocketRequest = LoadRoom & SocketRequest;

export type SocketRequest = {
  authToken: string;
};
type JoinSocketRequest = SocketRequest & JoinRoom;

class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User with ID ${userId} not found`);
    this.name = "UserNotFoundError";
  }
}

async function verifyUser(
  authService: AuthService,
  fastify: FastifyInstance,
  data: SocketRequest,
) {
  const userToken = authService.verify(fastify, {
    token: data.authToken,
  });
  const user = await fastify.orm.getRepository(User).findOne({
    where: {
      // @ts-ignore
      id: userToken.sub,
    },
  });

  if (!user) {
    fastify.log.info(`User with ID ${userToken.sub} not found`);
    throw new UserNotFoundError("User not found");
  }

  return user;
}

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  const authService = new AuthService(fastify.orm);
  const roomService = new RoomService(fastify.orm);
  // connection stuff
  fastify.io.on("connection", (socket) => {
    fastify.log.info("a user connected");
    // middleware to parse JSON payloads
    socket.use((packet, next) => {
      try {
        if (typeof packet[1] === "string") {
          packet[1] = JSON.parse(packet[1]);
        }
      } catch (e) {
        fastify.log.error("Invalid JSON payload");
      }
      next();
    });
    socket.emit("connection", { data: `id: ${socket.id} is connected` });

    socket.on("disconnect", () => {
      fastify.log.info("user disconnected");
      socket.broadcast.emit("disconnection", `user ${socket.id} disconnected`);
    });

    socket.on("join_room_bus", async (data: RoomMessage) => {
      try {
        const user = await verifyUser(authService, fastify, data);
        const room = await roomService.getRoomById(data.roomId);
        socket.emit("room", room);
        socket.join(room.id.toString());
      } catch (e) {
        if (e instanceof UserNotFoundError) {
          socket.emit("error", "Authentication failed");
        } else {
          socket.emit("error", e.message);
        }
      }
    });

    // game stuff
    socket.on("join", async (data: JoinSocketRequest) => {
      try {
        const user = await verifyUser(authService, fastify, data);
        const room = await roomService.joinRoom(user.id, data.difficulty);
        socket.emit("room", room);
        socket.join(room.id.toString());
      } catch (e) {
        if (e instanceof UserNotFoundError) {
          socket.emit("error", "Authentication failed");
        } else {
          socket.emit("error", e.message);
        }
      }
    });

    socket.on("loadRoom", async (data: LoadRoomSocketRequest) => {
      try {
        const user = await verifyUser(authService, fastify, data);
        const room = await roomService.getRoomById(data.roomId);
        socket.join(room.id.toString());
        socket.emit("room", room);
      } catch (e) {
        if (e instanceof UserNotFoundError) {
          socket.emit("error", "Authentication failed");
        } else {
          socket.emit("error", e.message);
        }
      }
    });

    socket.on("guess", async (data: GuessSocketRequest) => {
      try {
        const user = await verifyUser(authService, fastify, data);
        const coordinates = { x: data.x, y: data.y };
        const room = await roomService.guess(
          data.roomId,
          coordinates,
          data.guess,
          user.id,
        );

        socket.join(room.id.toString());
        socket.to(room.id.toString()).emit("guess", { message: room });
        socket.to(room.id.toString()).emit("room", { message: room });
      } catch (e) {
        if (e instanceof UserNotFoundError) {
          socket.emit("error", "Authentication failed");
        } else {
          socket.emit("error", e.message);
        }
      }
    });

    // chat stuff
    socket.on("message", async (data: MessageSocketRequest) => {
      try {
        const user = await verifyUser(authService, fastify, data);
        socket.broadcast.emit("message", data);
        fastify.log.info(data);
      } catch (e) {
        if (e instanceof UserNotFoundError) {
          socket.emit("error", "Authentication failed");
        } else {
          socket.emit("error", e.message);
        }
      }
    });

    socket.on("message_room", async (data: RoomMessage) => {
      try {
        const user = await verifyUser(authService, fastify, data);
        socket.broadcast
          .to(data.roomId.toString())
          .emit("message", data.message);
        fastify.log.info(data);
      } catch (e) {
        if (e instanceof UserNotFoundError) {
          socket.emit("error", "Authentication failed");
        } else {
          socket.emit("error", e.message);
        }
      }
    });
  });

  next();
}
