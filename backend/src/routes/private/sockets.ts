import { FastifyInstance } from "fastify";
import { RoomService } from "../../services/RoomService";
import { AuthService } from "../../services/AuthService";
import { RedisService } from "../../services/RedisService";
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
  type: '1v1' | '2v2' | 'free4all';
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

export type Challenge = {
  roomId: number;
  challengedId: number;
  difficulty: string;
};

async function verifyUser(
  authService: AuthService,
  fastify: FastifyInstance,
  socket: Socket,
) {
  const userToken = authService. verify(fastify, {
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
  const redisService = new RedisService(fastify.io);

  // connection stuff
  fastify.io.on("connection", async (socket) => {
    try {
      const user = await verifyUser(authService, fastify, socket);

      // Set user as online
      await fastify.orm.getRepository(User).update(user.id, { status: 'online' });
      await redisService.publishGameEvent(0, 'user_status_change', { userId: user.id, status: 'online' });

      // Add user to all their active rooms
      const rooms = await roomService.getRoomsByUserId(user.id);
      for (const room of rooms) {
        if (room.status === 'playing') {
          socket.join(room.id.toString());
          fastify.log.info(`User ${user.id} joined room ${room.id}`);
          // Log all sockets in this room
          const sockets = await fastify.io.in(room.id.toString()).fetchSockets();
          fastify.log.info(`Current sockets in room ${room.id}:`, Array.from(sockets));
        }
      }

      // Join a room for user-specific events
      socket.join(`user_${user.id}`);

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

      socket.on("disconnect", async () => {
        fastify.log.info("user disconnected");
        socket.broadcast.emit("disconnection", `user ${socket.id} disconnected`);
        // Set user as offline
        await fastify.orm.getRepository(User).update(user.id, { status: 'offline' });
        await redisService.publishGameEvent(0, 'user_status_change', { userId: user.id, status: 'offline' });
      });

      socket.on('heartbeat', async () => {
        // Update the user's lastActiveAt timestamp
        await fastify.orm.getRepository(User).update(user.id, {
          status: 'online',
          lastActiveAt: new Date()
        });
      });

      socket.on("join_room_bus", async (data: RoomMessage) => {
        try {
          const room = await roomService.getRoomById(data.roomId);
          socket.join(room.id.toString());
          fastify.log.info(`User ${user.id} joined room ${room.id} via join_room_bus`);
          // Log all sockets in this room
          const sockets = await fastify.io.in(room.id.toString()).fetchSockets();
          fastify.log.info(`Current sockets in room ${room.id}:`, Array.from(sockets));
          await redisService.publishGameEvent(room.id, 'room', room.toJSON());
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
          const room = await roomService.getRoomById(data.roomId);

          if (!room) {
            fastify.log.info(`Room ${data.roomId} not found during loadRoom`);
            await redisService.publishGameEvent(data.roomId, 'error', "Couldn't find room.");
          } else {
            socket.join(room.id.toString());
            fastify.log.info(`User ${user.id} joined room ${room.id} via loadRoom`);
            // Log all sockets in this room
            const sockets = await fastify.io.in(room.id.toString()).fetchSockets();
            fastify.log.info(`Current sockets in room ${room.id}: ${sockets.length} connections`);

            // Also join the user-specific room for direct messages
            socket.join(`user_${user.id}`);
            fastify.log.info(`User ${user.id} joined their user-specific room`);

            await redisService.publishGameEvent(room.id, 'room', room.toJSON());
          }
        } catch (e) {
          fastify.log.error(`Error in loadRoom:`, e);
          if (e instanceof UserNotFoundError) {
            await redisService.publishGameEvent(data.roomId, 'error', "Authentication failed");
          } else {
            await redisService.publishGameEvent(data.roomId, 'error', e.message);
          }
        }
      });

      socket.on("guess", async ({ roomId, x, y, guess }) => {
        try {
          fastify.log.info(`Received guess from user ${user.id} in room ${roomId}: ${guess} at [${x}, ${y}]`);
          const room = await roomService.handleGuess(roomId, user.id, x, y, guess);

          if (!room) {
            socket.emit("error", { message: "Room not found" });
            return;
          }

          // Log room state and connected sockets before broadcasting
          const sockets = await fastify.io.in(roomId.toString()).fetchSockets();
          fastify.log.info(`Broadcasting guess to ${sockets.length} sockets in room ${roomId}`);
          fastify.log.info(`Current sockets in room ${roomId}:`, sockets.map(s => s.id));

          // Use Redis to broadcast the room update
          await redisService.publishGameEvent(roomId, 'room', room.toJSON());

        } catch (error) {
          console.error("Error handling guess:", error);
          socket.emit("error", { message: "Failed to process guess" });
        }
      });

      // chat stuff
      socket.on(
        "message",
        async ({ message }: Message) => {
          try {
            await redisService.publishGameEvent(0, 'message', message);
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
          await redisService.publishGameEvent(data.roomId, 'message', data.message);
        } catch (e) {
          if (e instanceof UserNotFoundError) {
            await redisService.publishGameEvent(data.roomId, 'error', "Authentication failed");
          } else {
            await redisService.publishGameEvent(data.roomId, 'error', e.message);
          }
        }
      });

      socket.on("forfeit", async ({ roomId }: LoadRoom) => {
        try {
          const room = await roomService.forfeitGame(roomId, user.id);

          // Emit the updated room state to all players
          await redisService.publishGameEvent(room.id, 'room', room);
        } catch (e) {
          if (e instanceof UserNotFoundError) {
            socket.emit("error", "Authentication failed");
          } else {
            socket.emit("error", e.message);
          }
        }
      });

      socket.on("challenge", async (data: string) => {
        try {
          const { challengedId, difficulty } = JSON.parse(data) as Challenge;
          const room = await roomService.createChallengeRoom(user.id, challengedId, difficulty);
          socket.join(room.id.toString());
          await redisService.publishGameEvent(room.id, 'room', room.toJSON());
        } catch (error) {
          fastify.log.error(error);
          socket.emit("error", { message: "Failed to create challenge" });
        }
      });

      socket.on("accept_challenge", async (data: string) => {
        try {
          const { roomId } = JSON.parse(data) as { roomId: number };
          const room = await roomService.acceptChallenge(roomId, user.id);
          socket.join(room.id.toString());
          await redisService.publishGameEvent(room.id, 'room', room.toJSON());
        } catch (error) {
          fastify.log.error(error);
          socket.emit("error", { message: "Failed to accept challenge" });
        }
      });

      socket.on("reject_challenge", async (data: string) => {
        try {
          const { roomId } = JSON.parse(data) as { roomId: number };
          const room = await roomService.rejectChallenge(roomId);
          await redisService.publishGameEvent(room.id, 'room', room.toJSON());
        } catch (error) {
          fastify.log.error(error);
          socket.emit("error", { message: "Failed to reject challenge" });
        }
      });

      socket.on("ping", () => {
        socket.emit("pong");
      });

    } catch (error) {
      fastify.log.error(error);
      socket.disconnect();
    }
  });

  next();
}
