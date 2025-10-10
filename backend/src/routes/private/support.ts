import { FastifyInstance } from "fastify";
import { Support } from "../../entities/Support.entity";
import { User } from "../../entities/User.entity";

type CreateSupportParams = {
  type: "support" | "suggestion";
  comment: string;
};

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  // Get all support requests (admin only)
  fastify.get("/support", async (request, reply) => {
    if (!request.user.roles.includes("admin")) {
      reply.code(403).send({ error: "Unauthorized" });
      return;
    }

    const supportRepository = fastify.orm.getRepository(Support);
    const requests = await supportRepository.find({
      order: { created_at: "DESC" },
    });
    reply.send(requests);
  });

  // Get user's own support requests
  fastify.get("/support/me", async (request, reply) => {
    const supportRepository = fastify.orm.getRepository(Support);
    const requests = await supportRepository.find({
      where: { userId: request.user.id },
      order: { created_at: "DESC" },
    });
    reply.send(requests);
  });

  // Create a new support request
  fastify.post("/support", async (request, reply) => {
    const { type, comment } = request.body as CreateSupportParams;

    if (!type || !comment) {
      reply.code(400).send({ error: "Type and comment are required" });
      return;
    }

    const supportRepository = fastify.orm.getRepository(Support);
    const userRepository = fastify.orm.getRepository(User);

    const user = await userRepository.findOne({
      where: { id: request.user.id },
    });
    if (!user) {
      reply.code(404).send({ error: "User not found" });
      return;
    }

    const support = new Support();
    support.type = type;
    support.comment = comment;
    support.user = user;
    support.userId = user.id;

    await supportRepository.save(support);
    reply.send(support);
  });

  next();
}
