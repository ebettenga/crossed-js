import { FastifyInstance } from "fastify";
import { User } from "../../entities/User";
import { PhotoService } from "../../services/PhotoService";
import multipart from "@fastify/multipart";
import { ILike } from "typeorm";
import bcrypt from "bcrypt";

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  // Register multipart plugin for file uploads with increased limits
  fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
  });

  const photoService = new PhotoService();

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

    const { username, email } = request.body as {
      username?: string;
      email?: string;
    };

    // Validate input
    if (!username && !email) {
      reply.code(400).send({
        error: "At least one field (username or email) must be provided",
      });
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
      const existingUser = await userRepository.findOne({
        where: { username },
      });
      if (existingUser && existingUser.id !== request.user.id) {
        reply.code(400).send({ error: "Username already taken" });
        return;
      }
    }

    // Update user
    await userRepository.update(request.user.id, { username, email });
    const updatedUser = await userRepository.findOne({
      where: { id: request.user.id },
    });
    reply.send(updatedUser);
  });

  fastify.post("/me/photo", async (request, reply) => {
    if (!request.user) {
      reply.code(403).send({ error: "Unauthorized" });
      return;
    }

    try {
      const data = await request.file();
      if (!data) {
        reply.code(400).send({ error: "No file uploaded" });
        return;
      }

      fastify.log.info("File upload details:", {
        mimetype: data.mimetype,
        filename: data.filename,
        encoding: data.encoding,
        fieldname: data.fieldname,
      });

      // Validate file type
      if (!data.mimetype.startsWith("image/")) {
        reply.code(400).send({ error: "Only image files are allowed" });
        return;
      }

      const buffer = await data.toBuffer();
      fastify.log.info("File size:", { bytes: buffer.length });

      const processedPhoto = await photoService.processPhoto(buffer);
      fastify.log.info("Processed photo size:", {
        bytes: processedPhoto.length,
      });

      // Update user's photo in database
      const userRepository = fastify.orm.getRepository(User);
      await userRepository.update(request.user.id, {
        photo: processedPhoto,
        photoContentType: data.mimetype,
      });

      const updatedUser = await userRepository.findOne({
        where: { id: request.user.id },
      });
      reply.send(updatedUser);
    } catch (error) {
      fastify.log.error("Error uploading photo:", error);
      if (error.code === "FST_REQ_FILE_TOO_LARGE") {
        reply.code(413).send({ error: "File too large. Maximum size is 5MB." });
        return;
      }
      reply.code(500).send({ error: "Failed to upload photo" });
    }
  });

  fastify.get(
    "/users",
    async (request, reply) => {
      return await fastify.orm.getRepository(User).find();
    },
  );

  fastify.post("/users/change-password", async (request, reply) => {
    const { oldPassword, newPassword } = request.body as {
      oldPassword: string;
      newPassword: string;
    };

    const userRepository = fastify.orm.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: request.user.id },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user) {
      reply.code(404).send({ error: "User not found" });
      return;
    }

    if (user.id !== request.user.id) {
      reply.code(403).send({ error: "Unauthorized" });
      return;
    }
    fastify.log.info("Comparing password");
    fastify.log.info(oldPassword);
    fastify.log.info(user.password);
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      reply.code(401).send({ error: "Invalid old password" });
      return;
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userRepository.update(request.user.id, { password: hashedPassword });
    reply.send({ message: "Password changed successfully" });
  });

  // Get active users count
  fastify.get("/users/active", async (request, reply) => {
    // Update current user's status and last active time
    await fastify.orm.getRepository(User).update(request.user.id, {
      status: "online",
      lastActiveAt: new Date(),
    });
    const count = await fastify.orm.getRepository(User).count({
      where: {
        status: "online",
      },
    });

    fastify.log.info(`Active users count: ${count}`);
    return { count };
  });

  // Search users by username
  fastify.get<{
    Querystring: {
      query: string;
    };
  }>("/users/search", async (request, reply) => {
    const { query } = request.query;
    if (!query) {
      return [];
    }

    const users = await fastify.orm.getRepository(User).find({
      where: {
        username: ILike(`%${query}%`),
      },
      select: ["id", "username", "photo", "status"],
      take: 5, // Limit to 5 results
    });

    return users;
  });

  next();
}
