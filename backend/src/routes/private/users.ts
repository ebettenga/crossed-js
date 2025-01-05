import { FastifyInstance } from "fastify";
import { User } from "../../entities/User";

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  fastify.get("/me", async (request, reply) => {
    if (!request.user) {
      reply.code(403).send({ error: "Unauthorized" });
    }
    reply.send(request.user);
  });

  fastify.patch("/me", async (request, reply) => {
    if (!request.user) {
      reply.code(403).send({ error: "Unauthorized" });
      return;
    }

    const { username, email } = request.body as { username?: string; email?: string };
    
    // Validate input
    if (!username && !email) {
      reply.code(400).send({ error: "At least one field (username or email) must be provided" });
      return;
    }

    const userRepository = fastify.orm.getRepository(User);
    
    // Check if email is already taken
    if (email) {
      const existingUser = await userRepository.findOne({ where: { email } });
      if (existingUser && existingUser.id !== request.user.id) {
        reply.code(400).send({ error: "Email already taken" });
        return;
      }
    }

    // Check if username is already taken
    if (username) {
      const existingUser = await userRepository.findOne({ where: { username } });
      if (existingUser && existingUser.id !== request.user.id) {
        reply.code(400).send({ error: "Username already taken" });
        return;
      }
    }

    // Update user
    await userRepository.update(request.user.id, { username, email });
    const updatedUser = await userRepository.findOne({ where: { id: request.user.id } });
    reply.send(updatedUser);
  });

  fastify.get(
    "/users",
    async (request, reply) => {
      return await fastify.orm.getRepository(User).find();
    },
  );

  fastify.post("/change-password", async (request, reply) => {
    reply.status(501).send({ message: "Not implemented" });
    // const result = await change_password(fastify)(request.body);
    // reply.send(result);
  });

  next();
}
