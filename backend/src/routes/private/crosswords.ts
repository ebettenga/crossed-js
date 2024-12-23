import { FastifyInstance } from "fastify";
import { CrosswordService } from "../../services/CrosswordService";

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
    if (!request.user?.roles.includes("admin")) {
      reply.send({ error: "Unauthorized" });
    } else {
      await crosswordService.loadCrosswords();
    }
  });

  next();
}
