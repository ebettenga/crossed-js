import { FastifyInstance } from "fastify";
import { DataSource } from "typeorm";
import { User } from "../../src/entities/User";
import { fastify as createFastify } from "../../src/fastify";
import { registerDb } from "../../src/db";
import fastifySecureSession from "@fastify/secure-session";
import { config } from "../../src/config/config-ci";
import fs from "fs";
import path from "path";
import { redisService } from "../../src/services/RedisService";
import {
  emailQueue,
  gameInactivityQueue,
  gameTimeoutQueue,
  statusCleanupQueue,
} from "../../src/jobs/queues";

export interface FastifyTestContext {
  app: FastifyInstance;
  dataSource: DataSource;
}

/**
 * Setup a Fastify app for testing with database and authentication
 * @param routeImportPath - Path to the route module to register (e.g., "../../src/routes/private/logs")
 * @returns FastifyTestContext with app and dataSource
 */
export async function setupFastifyTest(
  routeImportPath: string,
): Promise<FastifyTestContext> {
  // Create and configure Fastify app
  const app = createFastify;

  // Register database
  await registerDb(app);

  // Register secure session
  await app.register(fastifySecureSession, {
    key: fs.readFileSync(
      path.join(process.cwd(), "src", config.secretKeyPath),
    ),
  });

  // Manually register authentication hook (instead of using .autohooks.js)
  const { AuthService } = await import("../../src/services/AuthService");
  const authService = new AuthService(app.orm);

  app.decorateRequest("user", null);
  app.addHook("preHandler", async (request, reply) => {
    const authHeader = request.headers["authorization"] ||
      request.headers["Authorization"];
    const authHeaderStr = Array.isArray(authHeader)
      ? authHeader[0]
      : authHeader;

    if (authHeaderStr && authHeaderStr.startsWith("Bearer ")) {
      const token = authHeaderStr.slice(7, authHeaderStr.length);
      try {
        const user = await authService.verify(app, { token });
        const userId = typeof user.sub === "function" ? user.sub() : user.sub;
        const userRecord = await app.orm
          .getRepository(User)
          .findOne({ where: { id: Number(userId) } });

        if (!userRecord) {
          reply.code(403).send({ error: "Unauthorized" });
          return;
        }
        request.user = userRecord as User;
      } catch (err) {
        app.log.error(err, "Token verification failed");
        reply.code(403).send({ error: "Unauthorized" });
      }
    } else {
      app.log.warn("Authorization header missing or malformed");
      reply.code(403).send({ error: "Unauthorized" });
    }
  });

  // Register the specified route
  const route = await import(routeImportPath);
  await app.register(route.default, { prefix: "/api" });

  await app.ready();

  return {
    app,
    dataSource: app.orm,
  };
}

/**
 * Cleanup after Fastify tests - closes all connections
 */
export async function cleanupFastifyTest(app: FastifyInstance): Promise<void> {
  // Close all Redis connections
  await redisService.close();

  // Close all BullMQ queues
  await emailQueue.close();
  await statusCleanupQueue.close();
  await gameTimeoutQueue.close();
  await gameInactivityQueue.close();

  // Close Fastify app
  if (app) {
    await app.close();
  }
}
