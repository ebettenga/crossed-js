import { FastifyInstance } from "fastify";
import { AuthService } from "../../services/AuthService";
import { emailService } from "../../services/EmailService";
import { User } from "../../entities/User";
import crypto from 'crypto';

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
      const userRepository = fastify.orm.getRepository(User);
      const user = await userRepository.findOne({ where: { email } });

      if (!user) {
        // Return success even if user not found to prevent email enumeration
        reply.send({ message: "If an account exists with that email, you will receive a password reset link" });
        return;
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

      // Save reset token to user
      await userRepository.update(user.id, {
        attributes: [
          ...(user.attributes || []).filter(attr => attr.key !== 'resetToken' && attr.key !== 'resetTokenExpiry'),
          { key: 'resetToken', value: resetToken },
          { key: 'resetTokenExpiry', value: resetTokenExpiry.toISOString() }
        ]
      });

      // Send reset email
      await emailService.sendPasswordResetEmail(user.email, user.username || 'User', resetToken);

      reply.send({ message: "If an account exists with that email, you will receive a password reset link" });
    } catch (error) {
      fastify.log.error('Error in forgot password:', error);
      reply.code(500).send({ error: "Failed to process password reset request" });
    }
  });

  fastify.post("/reset-password", async (request, reply) => {
    const { token, newPassword } = request.body as { token: string; newPassword: string };

    try {
      const userRepository = fastify.orm.getRepository(User);
      const user = await userRepository.findOne({
        where: {},
        select: ['id', 'attributes']
      });

      if (!user?.attributes) {
        reply.code(400).send({ error: "Invalid or expired reset token" });
        return;
      }

      const resetToken = user.attributes.find(attr => attr.key === 'resetToken')?.value;
      const resetTokenExpiry = user.attributes.find(attr => attr.key === 'resetTokenExpiry')?.value;

      if (!resetToken || !resetTokenExpiry || resetToken !== token) {
        reply.code(400).send({ error: "Invalid or expired reset token" });
        return;
      }

      if (new Date(resetTokenExpiry) < new Date()) {
        reply.code(400).send({ error: "Reset token has expired" });
        return;
      }

      // Update password and remove reset token
      await authService.updatePassword(user.id, newPassword);
      await userRepository.update(user.id, {
        attributes: user.attributes.filter(attr =>
          attr.key !== 'resetToken' && attr.key !== 'resetTokenExpiry'
        )
      });

      reply.send({ message: "Password has been reset successfully" });
    } catch (error) {
      fastify.log.error('Error in reset password:', error);
      reply.code(500).send({ error: "Failed to reset password" });
    }
  });

  next();
}
