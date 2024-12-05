import { FastifyInstance } from "fastify";
import { userPassport } from "../auth";
import { User } from "../entities/User";

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void
): void {
  fastify.get(
    "/users",
    // { preValidation: userPassport.authenticate("github") },
    async () => {
      return await fastify.orm.getRepository(User).find();
    }
  );

  next();
}
