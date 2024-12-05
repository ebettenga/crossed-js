import { FastifyInstance } from 'fastify';
// import { userPassport } from "../auth";

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  //   fastify.get("/auth/github/callback", async (request, response) => {
  //     return userPassport.authenticate("github");
  //   });

  next();
}
