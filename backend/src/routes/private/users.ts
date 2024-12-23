import { FastifyInstance } from "fastify";
import { User } from "../../entities/User";

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  fastify.get("/me", async (request, reply) => {
    if (!request.user) {
      reply.send({ error: "Unauthorized" });
    }
    reply.send(request.user);
  });

  fastify.get(
    "/users",
    async (request, reply) => {
      const users = await fastify.orm.getRepository(User).find();
      return users.map((user) => {
        const { password, ...rest } = user;
        return rest;
      });
    },
  );

  fastify.post("/change-password", async (request, reply) => {
    reply.status(501).send({ message: "Not implemented" });
    // const result = await change_password(fastify)(request.body);
    // reply.send(result);
  });

  next();
}
