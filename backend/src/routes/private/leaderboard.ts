import { FastifyInstance } from "fastify";
import { User } from "../../entities/User";
import { RoomService } from "../../services/RoomService";

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  const roomService = new RoomService(fastify.orm);

  fastify.get<{
    Querystring: {
      limit?: string;
    };
  }>(
    "/leaderboard",
    fastify.withResponseCache(
      {
        ttlSeconds: 30,
        key: (request) => {
          const limit = request.query.limit
            ? Math.max(parseInt(request.query.limit, 10) || 0, 1)
            : 10;
          return `leaderboard:${limit}`;
        },
      },
      async (request) => {
        const { limit: limitParam } = request.query;
        const limit = limitParam ? Math.max(parseInt(limitParam, 10), 1) : 10;

        const userRepository = fastify.orm.getRepository(User);
        const topUsers = await userRepository.find({
          order: { eloRating: "DESC" },
          take: limit,
        });

        const topElo = topUsers.map((user, index) => ({
          rank: index + 1,
          user: user.toJSON(),
        }));

        const topTimeTrials = await roomService.getGlobalTimeTrialLeaderboard(
          limit,
        );

        return {
          topElo,
          topTimeTrials,
        };
      },
    ),
  );

  next();
}
