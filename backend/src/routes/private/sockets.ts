import { FastifyInstance } from "fastify";
import { RoomService } from "../../services/RoomService";
import { AuthService } from "../../services/AuthService";
import { User } from "../../entities/User";
import { ForbiddenError, UserNotFoundError } from "../../errors/api";
import { Socket } from "socket.io";
import { redisService } from "../../services/RedisService";
import {
  createSocketEventService,
  roomChannel,
  userChannel,
} from "../../services/SocketEventService";
import { config } from "../../config/config";

export type Guess = {
  roomId: number;
  x: number;
  y: number;
  guess: string;
  guessId?: string;
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
  context?: string;
};

type Ack = (response: unknown) => void;

const asAck = (maybeAck: unknown): Ack | undefined =>
  typeof maybeAck === "function" ? (maybeAck as Ack) : undefined;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

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
  fastify.addHook("onClose", async () => {
    await roomService.close();
  });

  const setUserStatus = async (userId: number, status: "online" | "offline") => {
    await fastify.orm.getRepository(User).update(userId, { status });
    await socketEventService.emitToUsers([userId], "user_status_change", {
      userId,
      status,
    });
  };

  // Authenticate and subscribe to channels before the connection completes, so
  // the client can't receive "connect" (and start emitting) until every
  // channel it needs is joined. Recovered sessions skip this and keep their
  // previous rooms and data.
  fastify.io.use(async (socket, nextMiddleware) => {
    try {
      const user = await verifyUser(authService, fastify, socket);
      socket.data.userId = user.id;

      const openRooms = await roomService.getOpenRoomsForUser(user.id);
      socket.join([
        userChannel(user.id),
        ...openRooms.map((room) => roomChannel(room.id)),
      ]);
      nextMiddleware();
    } catch (error) {
      fastify.log.warn({ err: error }, "Socket authentication failed");
      const authError = new Error(
        error instanceof ForbiddenError || error instanceof UserNotFoundError
          ? "auth/invalid-token"
          : "auth/failed",
      ) as Error & { data?: unknown };
      authError.data = { code: authError.message };
      nextMiddleware(authError);
    }
  });

  // Handlers are registered synchronously so no event can arrive before its
  // listener exists.
  fastify.io.on("connection", (socket) => {
    const userId: number = socket.data.userId;

    // middleware to parse JSON payloads
    socket.use((packet, nextPacket) => {
      try {
        if (typeof packet[1] === "string") {
          packet[1] = JSON.parse(packet[1]);
        }
      } catch (e) {
        fastify.log.error("Invalid JSON payload");
      }
      nextPacket();
    });

    socket.on("disconnect", async () => {
      fastify.log.info({ userId }, "user disconnected");
      try {
        // The user may still be connected from another socket or instance
        const remaining = await fastify.io.in(userChannel(userId)).fetchSockets();
        if (remaining.length === 0) {
          await setUserStatus(userId, "offline");
        }
      } catch (error) {
        fastify.log.error({ err: error }, "Failed to update offline status");
      }
    });

    socket.on("heartbeat", async () => {
      await fastify.orm.getRepository(User).update(userId, {
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
        socket.join(roomChannel(room.id));
        socket.emit("room", room.toJSON());
      } catch (e) {
        socket.emit("error", errorMessage(e));
      }
    });

    // Snapshot of a single room for the requesting socket. Replies through the
    // ack when one is provided; legacy clients get a "room" event instead.
    const handleRoomSync = async (data: LoadRoom, maybeAck?: unknown) => {
      const ack = asAck(maybeAck);
      try {
        const room = await roomService.getRoomById(Number(data?.roomId));
        if (!room) {
          if (ack) ack({ error: "Room not found" });
          else socket.emit("error", "Room not found");
          return;
        }
        socket.join(roomChannel(room.id));
        const roomJSON = room.toJSON();
        if (ack) ack({ room: roomJSON });
        else socket.emit("room", roomJSON);
      } catch (e) {
        if (ack) ack({ error: errorMessage(e) });
        else socket.emit("error", errorMessage(e));
      }
    };
    socket.on("room:sync", handleRoomSync);
    socket.on("loadRoom", handleRoomSync);

    // The user's pending and playing rooms, used to resync after a reconnect
    // that could not be recovered
    socket.on("rooms:active", async (_data: unknown, maybeAck?: unknown) => {
      const ack = asAck(maybeAck) ?? asAck(_data);
      try {
        const rooms = await roomService.getOpenRoomsForUser(userId);
        socket.join(rooms.map((room) => roomChannel(room.id)));
        ack?.({ rooms: rooms.map((room) => room.toJSON()) });
      } catch (e) {
        ack?.({ error: errorMessage(e) });
      }
    });

    socket.on("guess", async (data: Guess, maybeAck?: unknown) => {
      const ack = asAck(maybeAck);
      const { roomId, x, y, guess, guessId } = data ?? ({} as Guess);
      let claimed = false;
      try {
        // Retries reuse the guess id, so a guess is applied at most once
        if (guessId) {
          claimed = await redisService.claimGuessId(
            roomId,
            guessId,
            config.socket.guessDedupeTTLSeconds,
          );
          if (!claimed) {
            const room = await roomService.getRoomById(roomId);
            ack?.({ success: true, duplicate: true, room: room?.toJSON() });
            return;
          }
        }

        const updatedRoom = await roomService.handleGuess(
          roomId,
          userId,
          x,
          y,
          guess,
        );

        const roomJSON = updatedRoom.toJSON();
        await socketEventService.emitToRoom(roomId, "room", roomJSON);
        ack?.({ success: true, room: roomJSON });
      } catch (error) {
        fastify.log.error({ err: error }, "Error handling guess");
        if (claimed && guessId) {
          await redisService.releaseGuessId(roomId, guessId).catch(() => {});
        }
        ack?.({ success: false, error: "Failed to process guess" });
        socket.emit("error", { message: "Failed to process guess" });
      }
    });

    // chat stuff
    socket.on("message", async ({ message }: Message) => {
      try {
        await socketEventService.emitToUsers([userId], "message", message);
      } catch (e) {
        socket.emit("error", errorMessage(e));
      }
    });

    socket.on("message_room", async (data: RoomMessage) => {
      try {
        socket.broadcast
          .to(roomChannel(data.roomId))
          .emit("message", data.roomId);
      } catch (e) {
        socket.emit("error", errorMessage(e));
      }
    });

    socket.on("forfeit", async ({ roomId }: LoadRoom, maybeAck?: unknown) => {
      const ack = asAck(maybeAck);
      try {
        const room = await roomService.forfeitGame(roomId, userId);
        const roomJSON = room.toJSON();
        await socketEventService.emitToRoom(room.id, "room", roomJSON);
        ack?.({ success: true, room: roomJSON });
      } catch (e) {
        ack?.({ success: false, error: errorMessage(e) });
        socket.emit("error", errorMessage(e));
      }
    });

    socket.on("challenge", async (data: Challenge) => {
      try {
        const { challengedId, difficulty, context } = data;
        const room = await roomService.createChallengeRoom(
          userId,
          challengedId,
          difficulty,
          context,
        );
        const participantIds = room.players.map((player) => player.id);
        await socketEventService.joinUsersToRoom(participantIds, room.id);
        await socketEventService.emitToRoom(room.id, "room", room.toJSON());
        await socketEventService.emitToUsers(
          participantIds,
          "challenges:updated",
          {
            roomId: room.id,
            status: room.status,
            action: "created",
          },
        );
      } catch (error) {
        fastify.log.error({ err: error });
        socket.emit("error", { message: "Failed to create challenge" });
      }
    });

    socket.on("accept_challenge", async (data: { roomId: number }) => {
      try {
        const room = await roomService.acceptChallenge(data.roomId, userId);
        socket.join(roomChannel(room.id));
        await socketEventService.emitToRoom(room.id, "room", room.toJSON());
        const participantIds = room.players.map((player) => player.id);
        await socketEventService.emitToUsers(
          participantIds,
          "challenges:updated",
          {
            roomId: room.id,
            status: room.status,
            action: "accepted",
          },
        );
      } catch (error) {
        fastify.log.error({ err: error });
        socket.emit("error", { message: "Failed to accept challenge" });
      }
    });

    socket.on("reject_challenge", async (data: { roomId: number }) => {
      try {
        const room = await roomService.rejectChallenge(data.roomId);
        await socketEventService.emitToRoom(room.id, "room", room.toJSON());
        const participantIds = room.players.map((player) => player.id);
        await socketEventService.emitToUsers(
          participantIds,
          "challenges:updated",
          {
            roomId: room.id,
            status: room.status,
            action: "rejected",
          },
        );
      } catch (error) {
        fastify.log.error({ err: error });
        socket.emit("error", { message: "Failed to reject challenge" });
      }
    });

    socket.on("ping", (maybeAck?: unknown) => {
      asAck(maybeAck)?.(undefined);
      socket.emit("pong");
    });

    socket.emit("connection", { data: `id: ${socket.id} is connected` });
    fastify.log.info(
      { userId, recovered: socket.recovered },
      "a user connected",
    );

    setUserStatus(userId, "online").catch((error) => {
      fastify.log.error({ err: error }, "Failed to update online status");
    });
  });

  next();
}
