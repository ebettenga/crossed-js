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

  fastify.post("/forgot-password", async (request, reply) => {
    const { email } = request.body as { email: string };

    try {
      await authService.forgotPassword(email);
      reply.send({
        message: "If an account exists with that email, you will receive a password reset link"
      });
    } catch (error) {
      fastify.log.error('Error in forgot password:', error);
      reply.code(500).send({ error: "Failed to process password reset request" });
    }
  });

  fastify.post("/reset-password", async (request, reply) => {
    const { token, newPassword } = request.body as { token: string; newPassword: string };

    try {
      await authService.resetPassword(token, newPassword);
      reply.send({ message: "Password has been reset successfully" });
    } catch (error) {
      if (error instanceof ForbiddenError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      fastify.log.error('Error in reset password:', error);
      reply.code(500).send({ error: "Failed to reset password" });
    }
  });

  next();
}
