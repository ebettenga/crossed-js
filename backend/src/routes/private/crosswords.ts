import { FastifyInstance } from "fastify";
import { CrosswordService } from "../../services/CrosswordService";
import { CrosswordRatingService } from "../../services/CrosswordRatingService";
import { DifficultyRating } from "../../entities/CrosswordRating";

type CrosswordQueryParams = {
  page?: number;
  limit?: number;
  dow?: string;
  col_size?: number;
  row_size?: number;
};

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  const crosswordService = new CrosswordService(fastify.orm);
  const ratingService = new CrosswordRatingService(fastify.orm);

  fastify.get("/crosswords", async (request, reply) => {
    const {
      page = 1,
      limit = 100,
      dow,
      col_size,
      row_size,
    } = request.query as CrosswordQueryParams;
    const results = await crosswordService.getCrosswords(
      page,
      limit,
      dow,
      col_size,
      row_size,
    );
    reply.send(results);
  });

  fastify.post("/crosswords/load_crosswords", async (request, reply) => {
    if (!request.user) {
      reply.code(403).send({ error: "Unauthorized" });
    } else {
      await crosswordService.loadCrosswords();
    }
  });

  // Rate crossword difficulty
  fastify.post<{
    Body: {
      rating: DifficultyRating;
    };
    Params: {
      crosswordId: string;
    };
  }>("/crosswords/:crosswordId/rate-difficulty", async (request, reply) => {
    const { rating } = request.body;
    const crosswordId = parseInt(request.params.crosswordId);
    const userId = request.user.id;

    const result = await ratingService.rateDifficulty(userId, crosswordId, rating);
    return { success: true, rating: result };
  });

  // Rate crossword quality
  fastify.post<{
    Body: {
      rating: number;
    };
    Params: {
      crosswordId: string;
    };
  }>("/crosswords/:crosswordId/rate-quality", async (request, reply) => {
    const { rating } = request.body;
    const crosswordId = parseInt(request.params.crosswordId);
    const userId = request.user.id;

    const result = await ratingService.rateQuality(userId, crosswordId, rating);
    return { success: true, rating: result };
  });

  // Get crossword ratings
  fastify.get<{
    Params: {
      crosswordId: string;
    };
  }>("/crosswords/:crosswordId/ratings", async (request, reply) => {
    const crosswordId = parseInt(request.params.crosswordId);
    const ratings = await ratingService.getCrosswordRatings(crosswordId);
    return ratings;
  });

  next();
}
