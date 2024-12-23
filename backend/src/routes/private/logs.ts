import { FastifyInstance } from "fastify";
import { Log } from "../../entities/Log";

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  fastify.get("/logs", async () => {
    fastify.log.info("Getting all logs");
    const logs = await fastify.orm.getRepository(Log).find();
    return logs;
  });

  fastify.post("/logs", async (request, reply) => {
    const log = new Log();
    Object.assign(log, request.body);
    await fastify.orm.getRepository(Log).save(log);
    reply.code(201).send(log);
  });

  next();
}
