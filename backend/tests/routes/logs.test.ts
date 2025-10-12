import { FastifyInstance } from "fastify";
import { DataSource } from "typeorm";
import { Log } from "../../src/entities/Log";
import { User } from "../../src/entities/User";
import {
  cleanupTestEnvironment,
  createTestLogs,
  setupTestEnvironment,
  TestContext,
} from "./logs-test-setup";
import { fastify as createFastify } from "../../src/fastify";
import { registerDb } from "../../src/db";
import fastifySecureSession from "@fastify/secure-session";
import fastifyAutoload from "@fastify/autoload";
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

describe("Log Endpoints", () => {
  let app: FastifyInstance;
  let dataSource: DataSource;
  let testContext: TestContext | undefined;

  beforeAll(async () => {
    try {
      // Create and configure Fastify app
      app = createFastify;

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
            const userId = typeof user.sub === "function"
              ? user.sub()
              : user.sub;
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

      // Register only the logs route to avoid socket.io dependencies
      const logsRoute = await import("../../src/routes/private/logs");
      await app.register(logsRoute.default, { prefix: "/api" });

      await app.ready();

      // Get the data source from the app
      dataSource = app.orm;

      // Setup test environment
      testContext = await setupTestEnvironment(app, dataSource);
    } catch (error) {
      console.error("Error in beforeAll:", error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      // Clean up test data if testContext was created
      if (testContext?.testUser) {
        await cleanupTestEnvironment(dataSource, testContext.testUser);
      }

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
    } catch (error) {
      console.error("Error in afterAll:", error);
      throw error;
    }
  });

  beforeEach(async () => {
    // Clean up all logs before each test
    await dataSource.getRepository(Log).clear();
  });

  describe("GET /api/logs", () => {
    it("should return an empty array when no logs exist", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/logs",
        headers: {
          authorization: `Bearer ${testContext.authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const logs = JSON.parse(response.payload);
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBe(0);
    });

    it("should return all logs when they exist", async () => {
      // Create test logs
      const createdLogs = await createTestLogs(dataSource, 3);

      const response = await app.inject({
        method: "GET",
        url: "/api/logs",
        headers: {
          authorization: `Bearer ${testContext.authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const logs = JSON.parse(response.payload);
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBe(3);

      // Verify log structure
      logs.forEach((log: any) => {
        expect(log).toHaveProperty("id");
        expect(log).toHaveProperty("log");
        expect(log).toHaveProperty("severity");
        expect(log).toHaveProperty("created_at");
      });
    });

    it("should return logs with correct data", async () => {
      // Create a specific test log
      const logRepository = dataSource.getRepository(Log);
      const testLog = new Log();
      testLog.log = {
        message: "Specific test message",
        data: { key: "value" },
      };
      testLog.severity = "warning";
      await logRepository.save(testLog);

      const response = await app.inject({
        method: "GET",
        url: "/api/logs",
        headers: {
          authorization: `Bearer ${testContext.authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const logs = JSON.parse(response.payload);
      expect(logs.length).toBe(1);
      expect(logs[0].log.message).toBe("Specific test message");
      expect(logs[0].log.data.key).toBe("value");
      expect(logs[0].severity).toBe("warning");
    });

    it("should return 403 when no authorization header is provided", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/logs",
      });

      expect(response.statusCode).toBe(403);
      const error = JSON.parse(response.payload);
      expect(error).toHaveProperty("error");
      expect(error.error).toBe("Unauthorized");
    });

    it("should return 403 when invalid token is provided", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/logs",
        headers: {
          authorization: "Bearer invalid-token",
        },
      });

      expect(response.statusCode).toBe(403);
      const error = JSON.parse(response.payload);
      expect(error).toHaveProperty("error");
      expect(error.error).toBe("Unauthorized");
    });

    it("should return 403 when authorization header is malformed", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/logs",
        headers: {
          authorization: "InvalidFormat token",
        },
      });

      expect(response.statusCode).toBe(403);
      const error = JSON.parse(response.payload);
      expect(error).toHaveProperty("error");
      expect(error.error).toBe("Unauthorized");
    });
  });

  describe("POST /api/logs", () => {
    it("should create a new log with valid data", async () => {
      const newLog = {
        log: { message: "New log entry", level: "info" },
        severity: "info",
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/logs",
        headers: {
          authorization: `Bearer ${testContext.authToken}`,
          "content-type": "application/json",
        },
        payload: newLog,
      });

      expect(response.statusCode).toBe(201);
      const createdLog = JSON.parse(response.payload);
      expect(createdLog).toHaveProperty("id");
      expect(createdLog.log.message).toBe("New log entry");
      expect(createdLog.severity).toBe("info");
      expect(createdLog).toHaveProperty("created_at");

      // Verify log was saved to database
      const logRepository = dataSource.getRepository(Log);
      const savedLog = await logRepository.findOne({
        where: { id: createdLog.id },
      });
      expect(savedLog).not.toBeNull();
      expect(savedLog?.log).toEqual(newLog.log);
      expect(savedLog?.severity).toBe(newLog.severity);
    });

    it("should create a log with complex JSON data", async () => {
      const complexLog = {
        log: {
          message: "Complex log",
          metadata: {
            user: "testuser",
            action: "login",
            timestamp: new Date().toISOString(),
            details: {
              ip: "127.0.0.1",
              userAgent: "test-agent",
            },
          },
        },
        severity: "info",
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/logs",
        headers: {
          authorization: `Bearer ${testContext.authToken}`,
          "content-type": "application/json",
        },
        payload: complexLog,
      });

      expect(response.statusCode).toBe(201);
      const createdLog = JSON.parse(response.payload);
      expect(createdLog.log.metadata.user).toBe("testuser");
      expect(createdLog.log.metadata.details.ip).toBe("127.0.0.1");
    });

    it("should create logs with different severity levels", async () => {
      const severities = ["info", "warning", "error", "critical"];

      for (const severity of severities) {
        const response = await app.inject({
          method: "POST",
          url: "/api/logs",
          headers: {
            authorization: `Bearer ${testContext.authToken}`,
            "content-type": "application/json",
          },
          payload: {
            log: { message: `${severity} level log` },
            severity: severity,
          },
        });

        expect(response.statusCode).toBe(201);
        const createdLog = JSON.parse(response.payload);
        expect(createdLog.severity).toBe(severity);
      }

      // Verify all logs were created
      const logRepository = dataSource.getRepository(Log);
      const allLogs = await logRepository.find();
      expect(allLogs.length).toBe(severities.length);
    });

    it("should return 403 when no authorization header is provided", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/logs",
        headers: {
          "content-type": "application/json",
        },
        payload: {
          log: { message: "Test log" },
          severity: "info",
        },
      });

      expect(response.statusCode).toBe(403);
      const error = JSON.parse(response.payload);
      expect(error).toHaveProperty("error");
      expect(error.error).toBe("Unauthorized");
    });

    it("should return 403 when invalid token is provided", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/logs",
        headers: {
          authorization: "Bearer invalid-token",
          "content-type": "application/json",
        },
        payload: {
          log: { message: "Test log" },
          severity: "info",
        },
      });

      expect(response.statusCode).toBe(403);
      const error = JSON.parse(response.payload);
      expect(error).toHaveProperty("error");
      expect(error.error).toBe("Unauthorized");
    });

    it("should handle empty log object", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/logs",
        headers: {
          authorization: `Bearer ${testContext.authToken}`,
          "content-type": "application/json",
        },
        payload: {
          log: {},
          severity: "info",
        },
      });

      expect(response.statusCode).toBe(201);
      const createdLog = JSON.parse(response.payload);
      expect(createdLog.log).toEqual({});
    });

    it("should persist log data correctly", async () => {
      const logData = {
        log: { message: "Persistence test", id: 12345 },
        severity: "debug",
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/logs",
        headers: {
          authorization: `Bearer ${testContext.authToken}`,
          "content-type": "application/json",
        },
        payload: logData,
      });

      expect(response.statusCode).toBe(201);
      const createdLog = JSON.parse(response.payload);

      // Fetch the log again to verify persistence
      const getResponse = await app.inject({
        method: "GET",
        url: "/api/logs",
        headers: {
          authorization: `Bearer ${testContext.authToken}`,
        },
      });

      const logs = JSON.parse(getResponse.payload);
      const persistedLog = logs.find((l: any) => l.id === createdLog.id);
      expect(persistedLog).toBeDefined();
      expect(persistedLog.log.message).toBe("Persistence test");
      expect(persistedLog.log.id).toBe(12345);
      expect(persistedLog.severity).toBe("debug");
    });
  });
});
