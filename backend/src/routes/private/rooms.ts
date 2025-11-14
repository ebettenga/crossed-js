import { FastifyInstance } from "fastify";
import { RoomService } from "../../services/RoomService";
import { JoinRoom } from "./sockets";
import { createSocketEventService } from "../../services/SocketEventService";
import { NotificationService } from "../../services/NotificationService";

type Coordinates = {
  x: number;
  y: number;
};

type RoomQueryParams = {
  coordinates: Coordinates;
  guess: string;
};

type ChallengeParams = {
  challengedId: number;
  difficulty: string;
  context?: string;
};

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  const roomService = new RoomService(fastify.orm);
  const socketEventService = createSocketEventService(fastify);
  const notificationService = new NotificationService(
    fastify.orm,
    fastify.log,
  );

  fastify.get("/rooms/:roomId", async (request, reply) => {
    const params = request.params as { roomId: string };
    const room = await roomService.getRoomById(parseInt(params.roomId));

    reply.send(room.toJSON());
  });

  fastify.post("/rooms/:roomId/cancel", async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const cancelledRoom = await roomService.cancelRoom(
      parseInt(roomId, 10),
      request.user.id,
    );

    const playerIds = cancelledRoom.players.map((player) => player.id);
    const cancellationPayload = {
      message: "Game was cancelled",
      roomId: cancelledRoom.id,
      reason: "user_cancelled",
    };

    await socketEventService.emitToRoom(
      cancelledRoom.id,
      "room_cancelled",
      cancellationPayload,
    );
    await socketEventService.emitToUsers(
      playerIds,
      "room_cancelled",
      cancellationPayload,
    );

    reply.send(cancelledRoom.toJSON());
  });

  fastify.post("/rooms/join", async (request, reply) => {
    const { difficulty, type } = request.body as JoinRoom;
    const room = await roomService.joinRoom(request.user, difficulty, type);
    fastify.io.to(room.id.toString()).emit("room", room.toJSON());
    reply.send(room.toJSON());
  });

  fastify.post("/rooms/:roomId", async (request, reply) => {
    const { coordinates, guess } = request
      .body as RoomQueryParams;
    const { roomId } = request.params as { roomId: number };
    const room = await roomService.handleGuess(
      roomId,
      request.user.id,
      coordinates.x,
      coordinates.y,
      guess,
    );
    fastify.io.to(room.id.toString()).emit("room", room.toJSON());
    reply.send(room.toJSON());
  });

  fastify.get<{
    Querystring: {
      status?: "playing" | "pending" | "finished" | "cancelled";
    };
  }>(
    "/rooms",
    fastify.withResponseCache(
      {
        ttlSeconds: 5,
        shouldCache: (request) => Boolean(request.query.status !== "playing"),
        key: (request) => {
          const statusKey = request.query.status || "all";
          return `rooms:${request.user.id}:${statusKey}`;
        },
      },
      async (request) => {
        const { status } = request.query;
        const rooms = await roomService.getRoomsByUserAndStatus(
          request.user.id,
          status,
        );
        return rooms.map((room) => room.toJSON());
      },
    ),
  );

  // Get recent games with stats
  fastify.get<{
    Querystring: {
      startTime?: string;
      endTime?: string;
      limit?: string;
    };
  }>("/rooms/recent", async (request, reply) => {
    const { startTime, endTime, limit } = request.query;
    const startDate = startTime ? new Date(startTime) : undefined;
    const endDate = endTime ? new Date(endTime) : undefined;
    const limitNum = limit ? parseInt(limit) : 10;

    // Validate dates if provided
    if (startDate && isNaN(startDate.getTime())) {
      reply.code(400).send({ error: "Invalid startTime format" });
      return;
    }
    if (endDate && isNaN(endDate.getTime())) {
      reply.code(400).send({ error: "Invalid endTime format" });
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      reply.code(400).send({ error: "startTime must be before endTime" });
      return;
    }

    const recentGames = await roomService.getRecentGamesWithStats(
      request.user.id,
      limitNum,
      startDate,
      endDate,
    );
    reply.send(recentGames);
  });

  fastify.post("/rooms/challenge", async (request, reply) => {
    const { challengedId, difficulty, context } = request
      .body as ChallengeParams;
    const room = await roomService.createChallengeRoom(
      request.user.id,
      challengedId,
      difficulty,
      context,
    );
    for (const player of room.players) {
      fastify.io
        .in(`user_${player.id}`)
        .socketsJoin(room.id.toString());
    }
    fastify.io.to(room.id.toString()).emit("room", room.toJSON());
    const participantIds = room.players.map((player) => player.id);
    await socketEventService.emitToUsers(participantIds, "challenges:updated", {
      roomId: room.id,
      status: room.status,
      action: "created",
    });
    await notificationService.notifyChallengeReceived({
      challengerId: request.user.id,
      challengedId,
      roomId: room.id,
      difficulty,
      context,
    });
    reply.send(room.toJSON());
  });

  fastify.post("/rooms/challenge/:roomId/accept", async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const room = await roomService.acceptChallenge(
      parseInt(roomId),
      request.user.id,
    );
    fastify.io.to(room.id.toString()).emit("room", room.toJSON());
    const participantIds = room.players.map((player) => player.id);
    await socketEventService.emitToUsers(participantIds, "challenges:updated", {
      roomId: room.id,
      status: room.status,
      action: "accepted",
    });
    const challenger = room.players.find((player) =>
      player.id !== request.user.id
    );
    if (challenger) {
      await notificationService.notifyChallengeAccepted({
        challengerId: challenger.id,
        challengedId: request.user.id,
        roomId: room.id,
        difficulty: room.difficulty,
      });
    }
    reply.send(room.toJSON());
  });

  fastify.post("/rooms/challenge/:roomId/reject", async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const room = await roomService.rejectChallenge(parseInt(roomId));
    fastify.io.to(room.id.toString()).emit("room", room.toJSON());
    const participantIds = room.players.map((player) => player.id);
    await socketEventService.emitToUsers(participantIds, "challenges:updated", {
      roomId: room.id,
      status: room.status,
      action: "rejected",
    });
    reply.send(room.toJSON());
  });

  fastify.get("/rooms/challenges/pending", async (request, reply) => {
    const userId = request.user.id;
    const challenges = await roomService.getPendingChallenges(userId);
    reply.send(challenges.map((room) => {
      room.markModified();
      return room.toJSON();
    }));
  });

  // Get time-trial leaderboard for a specific room's crossword
  fastify.get<{
    Params: { roomId: string };
    Querystring: { limit?: string };
  }>("/rooms/:roomId/leaderboard/time-trial", async (request, reply) => {
    const { roomId } = request.params;
    const { limit } = request.query;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const room = await roomService.getRoomById(parseInt(roomId, 10));
    if (!room) {
      reply.code(404).send({ error: "Room not found" });
      return;
    }
    if (room.type !== "time_trial") {
      reply.code(400).send({
        error: "Leaderboard is only available for time_trial games",
      });
      return;
    }

    const result = await roomService.getTimeTrialLeaderboard(
      room.id,
      limitNum,
    );
    reply.send(result);
  });

  // Get game stats for a specific room
  fastify.get<{
    Params: { roomId: string };
  }>("/rooms/:roomId/stats", async (request, reply) => {
    const { roomId } = request.params;
    const room = await roomService.getRoomById(parseInt(roomId, 10));

    if (!room) {
      reply.code(404).send({ error: "Room not found" });
      return;
    }

    // Only return stats for finished games
    if (room.status !== "finished") {
      reply.code(400).send({
        error: "Game stats are only available for finished games",
      });
      return;
    }

    // Get stats with user relation
    const gameStatsRepo = fastify.orm.getRepository("GameStats");
    const stats = await gameStatsRepo.find({
      where: { roomId: room.id },
      relations: ["user"],
    });

    const formattedStats = stats.map((stat: any) => ({
      userId: stat.userId,
      correctGuesses: stat.correctGuesses,
      incorrectGuesses: stat.incorrectGuesses,
      isWinner: stat.isWinner,
      eloAtGame: stat.eloAtGame,
      eloChange: stat.user ? stat.user.eloRating - stat.eloAtGame : undefined,
      correctGuessDetails: stat.correctGuessDetails,
    }));

    reply.send(formattedStats);
  });

  next();
}
