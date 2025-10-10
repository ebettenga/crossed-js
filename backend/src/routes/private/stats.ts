import { FastifyInstance } from "fastify";
import { EloService } from "../../services/EloService";
import { User } from "../../entities/User.entity";
import { Room } from "../../entities/Room.entity";
import { GameStats } from "../../entities/GameStats.entity";

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  const eloService = new EloService(
    fastify.orm.getRepository(User),
    fastify.orm.getRepository(Room),
    fastify.orm.getRepository(GameStats),
  );

  fastify.get<{
    Querystring: {
      startTime?: string;
      endTime?: string;
    };
  }>("/stats/me", async (request, reply) => {
    if (!request.user) {
      reply.code(403).send({ error: "Unauthorized" });
      return;
    }

    const { startTime, endTime } = request.query;
    const startDate = startTime ? new Date(startTime) : undefined;
    const endDate = endTime ? new Date(endTime) : undefined;

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

    try {
      const stats = await eloService.getUserGameStats(
        request.user.id,
        startDate,
        endDate,
      );

      // Transform the data to match the frontend's expected format
      const transformedStats = stats.map((stat) => ({
        id: stat.id,
        userId: stat.userId,
        roomId: stat.roomId,
        correctGuesses: stat.correctGuesses,
        incorrectGuesses: stat.incorrectGuesses,
        correctGuessDetails: stat.correctGuessDetails || [],
        isWinner: stat.isWinner,
        winStreak: stat.winStreak,
        eloAtGame: stat.eloAtGame,
        createdAt: stat.createdAt,
        room: stat.room.toJSON(),
      }));

      reply.send(transformedStats);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({ error: "Failed to fetch user stats" });
    }
  });

  next();
}
