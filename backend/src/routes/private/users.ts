import { FastifyInstance } from "fastify";
import { User } from "../../entities/User";
import { PhotoService } from "../../services/PhotoService";
import multipart from "@fastify/multipart";
import { ILike } from "typeorm";
import bcrypt from "bcrypt";
import { config } from "../../config/config";

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
  const expoTokenKeys =
    config.notifications?.expo?.tokenAttributes?.length
      ? config.notifications.expo.tokenAttributes
      : ["expoPushToken"];

  const parseStoredTokens = (raw?: string | null): string[] => {
    if (!raw) {
      return [];
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }

    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}"))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((value) => {
              if (typeof value === "string") {
                return value.trim();
              }
              if (value && typeof value === "object" && "token" in value) {
                const tokenValue = (value as { token?: unknown }).token;
                return typeof tokenValue === "string"
                  ? tokenValue.trim()
                  : "";
              }
              return String(value ?? "").trim();
            })
            .filter((value) => value.length > 0);
        }
      } catch {
        // Fall through to treat the raw string as a single token
      }
    }

    return [trimmed];
  };

  const serializeTokens = (tokens: string[]): string => JSON.stringify(tokens);

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

  fastify.post("/users/push-tokens", async (request, reply) => {
    if (!request.user) {
      reply.code(403).send({ error: "Unauthorized" });
      return;
    }

    const { token } = request.body as { token?: unknown };
    if (typeof token !== "string" || token.trim().length === 0) {
      reply.code(400).send({ error: "A valid Expo push token is required." });
      return;
    }

    const normalizedToken = token.trim();
    const userRepository = fastify.orm.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: request.user.id },
      select: {
        id: true,
        attributes: true,
      },
    });

    if (!user) {
      reply.code(404).send({ error: "User not found" });
      return;
    }

    const attributes = Array.isArray(user.attributes)
      ? [...user.attributes]
      : [];
    const attributeKey = expoTokenKeys[0];
    const existingAttribute = attributes.find(
      (attribute) => attribute.key === attributeKey,
    );
    const tokens = existingAttribute
      ? parseStoredTokens(existingAttribute.value)
      : [];

    if (!tokens.includes(normalizedToken)) {
      tokens.push(normalizedToken);
    }

    const serialized = serializeTokens(tokens);
    if (existingAttribute) {
      existingAttribute.value = serialized;
    } else {
      attributes.push({
        key: attributeKey,
        value: serialized,
      });
    }

    await userRepository.update(user.id, { attributes });
    reply.send({ tokens });
  });

  fastify.delete("/users/push-tokens", async (request, reply) => {
    if (!request.user) {
      reply.code(403).send({ error: "Unauthorized" });
      return;
    }

    const { token } = request.body as { token?: unknown };
    if (typeof token !== "string" || token.trim().length === 0) {
      reply.code(400).send({ error: "A valid Expo push token is required." });
      return;
    }

    const normalizedToken = token.trim();
    const userRepository = fastify.orm.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: request.user.id },
      select: {
        id: true,
        attributes: true,
      },
    });

    if (!user) {
      reply.code(404).send({ error: "User not found" });
      return;
    }

    const attributes = Array.isArray(user.attributes)
      ? [...user.attributes]
      : [];
    const attributeKey = expoTokenKeys[0];
    const existingAttributeIndex = attributes.findIndex(
      (attribute) => attribute.key === attributeKey,
    );

    if (existingAttributeIndex === -1) {
      reply.send({ removed: false, tokens: [] });
      return;
    }

    const existingAttribute = attributes[existingAttributeIndex];
    const tokens = parseStoredTokens(existingAttribute.value);
    const filteredTokens = tokens.filter((value) => value !== normalizedToken);

    if (filteredTokens.length === tokens.length) {
      reply.send({ removed: false, tokens });
      return;
    }

    if (filteredTokens.length === 0) {
      attributes.splice(existingAttributeIndex, 1);
    } else {
      existingAttribute.value = serializeTokens(filteredTokens);
    }

    await userRepository.update(user.id, { attributes });
    reply.send({ removed: true, tokens: filteredTokens });
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

      fastify.log.info({
        mimetype: data.mimetype,
        filename: data.filename,
        encoding: data.encoding,
        fieldname: data.fieldname,
      }, "File upload details");

      // Validate file type
      if (!data.mimetype.startsWith("image/")) {
        reply.code(400).send({ error: "Only image files are allowed" });
        return;
      }

      const buffer = await data.toBuffer();
      fastify.log.info({ bytes: buffer.length }, "File size");

      const processedPhoto = await photoService.processPhoto(buffer);
      fastify.log.info({
        bytes: processedPhoto.length,
      }, "Processed photo size");

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
      fastify.log.error({ err: error }, "Error uploading photo");
      if (error.code === "FST_REQ_FILE_TOO_LARGE") {
        reply.code(413).send({ error: "File too large. Maximum size is 5MB." });
        return;
      }
      reply.code(500).send({ error: "Failed to upload photo" });
    }
  });

  const searchUsers = async (query: string) => {
    return fastify.orm.getRepository(User).find({
      where: {
        username: ILike(`%${query}%`),
      },
      select: ["id", "username", "photo", "status"],
      take: 5,
    });
  };

  fastify.get<{
    Querystring: {
      query?: string;
    };
  }>("/users", async (request, reply) => {
    const { query } = request.query;
    if (!query || query.trim().length === 0) {
      return await fastify.orm.getRepository(User).find();
    }

    return await searchUsers(query);
  });

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
    if (!query || query.trim().length === 0) {
      return [];
    }

    return await searchUsers(query);
  });

  next();
}
