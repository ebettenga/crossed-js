import { FastifyInstance } from "fastify";
import { RoomService } from "../../services/RoomService";
import { JoinRoom } from "./sockets";

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
};

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  const roomService = new RoomService(fastify.orm);

  fastify.get("/rooms/:roomId", async (request, reply) => {
    const params = request.params as { roomId: string };
    const room = await roomService.getRoomById(parseInt(params.roomId));

    reply.send(room.toJSON());
  });

  fastify.post("/rooms/:roomId/cancel", async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const room = await roomService.cancelRoom(parseInt(roomId));
    reply.send(room.toJSON());
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

  fastify.get("/rooms", async (request, reply) => {
    const { status } = request.query as {
      status?: "playing" | "pending" | "finished" | "cancelled";
    };
    const rooms = await roomService.getRoomsByUserAndStatus(
      request.user.id,
      status,
    );
    reply.send(rooms.map((room) => room.toJSON()));
  });

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
    const { challengedId, difficulty } = request.body as ChallengeParams;
    const room = await roomService.createChallengeRoom(
      request.user.id,
      challengedId,
      difficulty,
    );
    for (const player of room.players) {
      fastify.io
        .in(`user_${player.id}`)
        .socketsJoin(room.id.toString());
    }
    fastify.io.to(room.id.toString()).emit("room", room.toJSON());
    reply.send(room.toJSON());
  });

  fastify.post("/rooms/challenge/:roomId/accept", async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const room = await roomService.acceptChallenge(
      parseInt(roomId),
      request.user.id,
    );
    fastify.io.to(room.id.toString()).emit("room", room.toJSON());
    reply.send(room.toJSON());
  });

  fastify.post("/rooms/challenge/:roomId/reject", async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const room = await roomService.rejectChallenge(parseInt(roomId));
    fastify.io.to(room.id.toString()).emit("room", room.toJSON());
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

  next();
}
