import { FastifyInstance } from "fastify";
import { AuthService } from "../../services/AuthService";
import { ForbiddenError } from "../../errors/api";

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  const authService = new AuthService(fastify.orm);

  fastify.post("/signup", async (request, reply) => {
    const result = await authService.signup(fastify, request.body);
    reply.send(result);
  });

  fastify.post("/signin", async (request, reply) => {
    const result = await authService.signin(fastify, request.body);
    reply.send(result);
  });

  fastify.post("/refresh", async (request, reply) => {
    const result = await authService.refresh(fastify, request.body);
    reply.send(result);
  });

  next();
}
