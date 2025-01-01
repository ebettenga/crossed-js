import { FastifyInstance } from "fastify";
import { RoomService } from "../../services/RoomService"; // Assuming room_service is exported from RoomService
import { AuthService } from "../../services/AuthService";
import { User } from "../../entities/User";
import { UserNotFoundError } from "../../errors/api";
import { Socket } from "socket.io";

export type Guess = {
  roomId: number;
  x: number;
  y: number;
  guess: string;
};

export type JoinRoom = {
  difficulty: string;
};

export type Message = {
  message: string;
};

export type RoomMessage = {
  roomId: number;
} & Message;

export type LoadRoom = {
  roomId: number;
};

async function verifyUser(
  authService: AuthService,
  fastify: FastifyInstance,
  socket: Socket,
) {
  console.log(socket.handshake.auth.authToken);
  const userToken = authService.verify(fastify, {
    token: socket.handshake.auth.authToken,
  });
  const user = await fastify.orm.getRepository(User).findOne({
    where: {
      // @ts-ignore
      id: userToken.sub,
    },
  });

  if (!user) {
    fastify.log.info(`User with ID ${userToken.sub} not found`);
    throw new UserNotFoundError(userToken.sub as string);
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
        const user = await verifyUser(authService, fastify, socket);
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
    socket.on("join", async (data: JoinRoom) => {
      try {
        const user = await verifyUser(authService, fastify, socket);
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

    socket.on("loadRoom", async (data: LoadRoom) => {
      try {
        const user = await verifyUser(authService, fastify, socket);
        const room = await roomService.getRoomById(data.roomId);

        if (!room) {
          socket.emit("error", "Couldn't find room.");
        } else {
          socket.join(room.id.toString());
          socket.emit("room", room);
        }
      } catch (e) {
        if (e instanceof UserNotFoundError) {
          socket.emit("error", "Authentication failed");
        } else {
          socket.emit("error", e.message);
        }
      }
    });

    socket.on("guess", async (data: Guess) => {
      try {
        const user = await verifyUser(authService, fastify, socket);
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
    socket.on(
      "message",
      async ({ message }: Message) => {
        try {
          const user = await verifyUser(authService, fastify, socket);
          socket.emit("message", message);
          fastify.log.info(message);
        } catch (e) {
          if (e instanceof UserNotFoundError) {
            socket.emit("error", "Authentication failed");
          } else {
            socket.emit("error", e.message);
          }
        }
      },
    );

    socket.on("message_room", async (data: RoomMessage) => {
      try {
        const user = await verifyUser(authService, fastify, socket);
        socket.broadcast
          .to(data.roomId.toString())
          .emit("message", data.roomId);
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
