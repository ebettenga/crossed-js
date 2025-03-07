import { FastifyInstance } from "fastify";
import { RoomService } from "../../services/RoomService";
import { AuthService } from "../../services/AuthService";
import { User } from "../../entities/User";
import { UserNotFoundError } from "../../errors/api";
import { Socket } from "socket.io";
import { redisService } from "../../services/RedisService";
import { createSocketEventService } from "../../services/SocketEventService";
import { Room } from "../../entities/Room";

export type Guess = {
  roomId: number;
  x: number;
  y: number;
  guess: string;
};

export type JoinRoom = {
  difficulty: string;
  type: "1v1" | "2v2" | "free4all";
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
  const socketEventService = createSocketEventService(fastify);

  // Subscribe to game events from Redis
  redisService.subscribe("game_events", async (channel, message) => {
    try {
      const event = JSON.parse(message);

      if (event.type === "room_cancelled") {
        const { roomId, message: cancelMessage, reason, players } = event.data;

        // Only emit to players that are connected to this server
        for (const playerId of players) {
          const isOnThisServer = await redisService.isUserOnThisServer(
            playerId,
          );
          if (isOnThisServer) {
            fastify.io.to(`user_${playerId}`).emit("room_cancelled", {
              message: cancelMessage,
              roomId,
              reason,
            });
          }
        }

        // Also emit to the room channel for any spectators on this server
        fastify.io.to(roomId.toString()).emit("room_cancelled", {
          message: cancelMessage,
          roomId,
          reason,
        });
      }
    } catch (error) {
      fastify.log.error("Error handling Redis message:", error);
    }
  });

  // Subscribe to socket events from Redis
  redisService.subscribe("socket_events", (channel, message) => {
    socketEventService.handleSocketEvent(channel, message);
  });

  // connection stuff
  fastify.io.on("connection", async (socket) => {
    try {
      const user = await verifyUser(authService, fastify, socket);

      // Register this user's socket connection with this server
      await redisService.registerUserSocket(user.id);

      // Set user as online
      await fastify.orm.getRepository(User).update(user.id, {
        status: "online",
      });
      await socketEventService.emitToUsers([user.id], "user_status_change", {
        userId: user.id,
        status: "online",
      });

      // Add user to all their active rooms
      const rooms = await roomService.getRoomsByUserId(user.id);
      for (const room of rooms) {
        // Join both playing and pending rooms to receive updates
        if (room.status === "playing" || room.status === "pending") {
          socket.join(room.id.toString());
          socket.join(`user_${user.id}`);
          fastify.log.info(`User ${user.id} joined room ${room.id}`);
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

      socket.on("disconnect", () => {
        fastify.log.info("user disconnected");
        // Set user as offline and unregister their socket
        fastify.orm.getRepository(User).update(user.id, { status: "offline" })
          .then(async () => {
            await socketEventService.emitToUsers(
              [user.id],
              "user_status_change",
              {
                userId: user.id,
                status: "offline",
              },
            );
            await redisService.unregisterUserSocket(user.id);
          });
      });

      socket.on("heartbeat", async () => {
        // Update the user's lastActiveAt timestamp
        await fastify.orm.getRepository(User).update(user.id, {
          status: "online",
          lastActiveAt: new Date(),
        });
      });

      socket.on("join_room_bus", async (data: RoomMessage) => {
        try {
          const room = await roomService.getRoomById(data.roomId);
          if (!room) {
            socket.emit("error", "Room not found");
            return;
          }
          socket.join(room.id.toString());
          await socketEventService.emitToRoom(room.id, "room", room.toJSON());
          fastify.log.info(
            `User ${user.id} joined room ${room.id} via join_room_bus`,
          );
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
            socket.emit("error", "Room not found");
            return;
          }
          socket.join(room.id.toString());
          await socketEventService.emitToRoom(room.id, "room", room.toJSON());
          fastify.log.info(
            `User ${user.id} joined room ${room.id} via loadRoom`,
          );
        } catch (e) {
          if (e instanceof UserNotFoundError) {
            socket.emit("error", "Authentication failed");
          } else {
            socket.emit("error", e.message);
          }
        }
      });

      socket.on("guess", async ({ roomId, x, y, guess }) => {
        // Start a transaction
        const queryRunner = fastify.orm.createQueryRunner();
        await queryRunner.connect();

        try {
          // Start transaction before any database operations
          await queryRunner.startTransaction();

          // First get and lock just the room
          const room = await queryRunner.manager
            .getRepository(Room)
            .createQueryBuilder("room")
            .setLock("pessimistic_write")
            .where("room.id = :roomId", { roomId })
            .getOne();

          if (!room) {
            // Don't throw, just return after rolling back
            await queryRunner.rollbackTransaction();
            socket.emit("error", { message: "Room not found" });
            return;
          }

          // Now get the related crossword data and players in a separate query
          const roomWithRelations = await queryRunner.manager
            .getRepository(Room)
            .createQueryBuilder("room")
            .leftJoinAndSelect("room.crossword", "crossword")
            .leftJoinAndSelect("room.players", "players")
            .where("room.id = :roomId", { roomId })
            .getOne();

          // Merge all the relations into our locked room object
          Object.assign(room, {
            crossword: roomWithRelations.crossword,
            players: roomWithRelations.players
          });

          // Process the guess with the locked room
          const updatedRoom = await roomService.handleGuess(
            room,
            user.id,
            x,
            y,
            guess,
            queryRunner.manager
          );

          // Commit the transaction
          await queryRunner.commitTransaction();

          // Broadcast updated room state to all players
          const roomJSON = updatedRoom.toJSON()
          roomJSON.scores =
          await socketEventService.emitToRoom(roomId, "room",roomJSON );
        } catch (error) {
          // Only try to rollback if we successfully started the transaction
          if (queryRunner.isTransactionActive) {
            await queryRunner.rollbackTransaction();
          }
          console.error("Error handling guess:", error);
          socket.emit("error", { message: "Failed to process guess" });
        } finally {
          // Always release the queryRunner
          await queryRunner.release();
        }
      });

      // chat stuff
      socket.on(
        "message",
        async ({ message }: Message) => {
          try {
            await socketEventService.emitToUsers([user.id], "message", message);
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
          socket.broadcast
            .to(data.roomId.toString())
            .emit("message", data.roomId);
        } catch (e) {
          if (e instanceof UserNotFoundError) {
            socket.emit("error", "Authentication failed");
          } else {
            socket.emit("error", e.message);
          }
        }
      });

      socket.on("forfeit", async ({ roomId }: LoadRoom) => {
        try {
          const room = await roomService.forfeitGame(roomId, user.id);

          // Emit the updated room state to all players
          fastify.io.to(room.id.toString()).emit("room", room);
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
          const room = await roomService.createChallengeRoom(
            user.id,
            challengedId,
            difficulty,
          );
          socket.join(room.id.toString());
          fastify.io.to(room.id.toString()).emit("room", room.toJSON());
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
          fastify.io.to(room.id.toString()).emit("room", room.toJSON());
        } catch (error) {
          fastify.log.error(error);
          socket.emit("error", { message: "Failed to accept challenge" });
        }
      });

      socket.on("reject_challenge", async (data: string) => {
        try {
          const { roomId } = JSON.parse(data) as { roomId: number };
          const room = await roomService.rejectChallenge(roomId);
          fastify.io.to(room.id.toString()).emit("room", room.toJSON());
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
