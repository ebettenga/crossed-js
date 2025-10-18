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
  }>("/leaderboard", async (request, reply) => {
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

    reply.send({
      topElo,
      topTimeTrials,
    });
  });

  next();
}
