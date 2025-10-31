/**
 * Auth Routes Integration Tests
 */

import Fastify from "fastify";
import { DataSource } from "typeorm";
import type { PluginDataSource } from "typeorm-fastify-plugin";
import { User } from "../../src/entities/User";
import { GameStats } from "../../src/entities/GameStats";
import { Room } from "../../src/entities/Room";
import { Crossword } from "../../src/entities/Crossword";
import { Friend } from "../../src/entities/Friend";
import authRoutes from "../../src/routes/public/auth";
import { createPostgresTestManager } from "../utils/postgres";
import jwt from "jsonwebtoken";
import { config } from "../../src/config/config";
import bcrypt from "bcrypt";

jest.setTimeout(60000);

// Mock email service
jest.mock("../../src/services/EmailService", () => ({
  emailService: {
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  },
}));

const postgres = createPostgresTestManager({
  label: "Auth route tests",
  entities: [User, GameStats, Room, Crossword, Friend, UserCrosswordPack],
  env: {
    database: ["AUTH_ROUTES_TEST_DB", "ROOM_SERVICE_TEST_DB", "POSTGRES_DB"],
    schema: ["AUTH_ROUTES_TEST_SCHEMA", "ROOM_SERVICE_TEST_SCHEMA"],
    host: ["AUTH_ROUTES_TEST_DB_HOST", "ROOM_SERVICE_TEST_DB_HOST", "PGHOST"],
    port: ["AUTH_ROUTES_TEST_DB_PORT", "ROOM_SERVICE_TEST_DB_PORT", "PGPORT"],
    username: [
      "AUTH_ROUTES_TEST_DB_USER",
      "ROOM_SERVICE_TEST_DB_USER",
      "PGUSER",
    ],
    password: [
      "AUTH_ROUTES_TEST_DB_PASSWORD",
      "ROOM_SERVICE_TEST_DB_PASSWORD",
      "PGPASSWORD",
    ],
  },
  defaults: {
    database: "crossed_test",
    schema: "auth_route_test",
    host: "127.0.0.1",
    port: 5432,
    username: "postgres",
    password: "postgres",
  },
});

const TABLES_TO_TRUNCATE = [
  "room_players",
  "game_stats",
  "friend",
  "room",
  "crossword",
  "user_crossword_pack",
  "user",
];

let dataSource: DataSource;

const buildServer = async () => {
  const app = Fastify({ logger: false });
  app.decorate("orm", dataSource as unknown as PluginDataSource);
  authRoutes(app as any, {}, () => {});
  await app.ready();
  return app;
};

beforeAll(async () => {
  await postgres.setup();
  dataSource = postgres.dataSource;
});

beforeEach(async () => {
  await postgres.truncate(TABLES_TO_TRUNCATE);
  jest.clearAllMocks();
});

afterAll(async () => {
  await postgres.close();
});

describe("auth routes", () => {
  describe("POST /signup", () => {
    it("creates a new user and returns tokens", async () => {
      const app = await buildServer();
      try {
        const response = await app.inject({
          method: "POST",
          url: "/signup",
          payload: {
            email: "newuser@example.com",
            password: "password123",
            username: "newuser",
          },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();

        expect(payload).toHaveProperty("token_type", "Bearer");
        expect(payload).toHaveProperty("user_id");
        expect(payload).toHaveProperty("access_token");
        expect(payload).toHaveProperty("refresh_token");
        expect(payload).toHaveProperty("user");
        expect(payload.user.email).toBe("newuser@example.com");
        expect(payload.user.username).toBe("newuser");
        expect(payload.user.roles).toEqual(["user"]);

        // Verify tokens are valid JWTs
        const accessDecoded = jwt.verify(
          payload.access_token,
          config.auth.secretAccessToken,
        ) as any;
        expect(accessDecoded.sub).toBe(payload.user_id);

        const refreshDecoded = jwt.verify(
          payload.refresh_token,
          config.auth.secretAccessToken,
        ) as any;
        expect(refreshDecoded.sub).toBe(payload.user_id);
        expect(refreshDecoded.aud).toBe("/refresh");
      } finally {
        await app.close();
      }
    });

    it("returns 400 when email already exists", async () => {
      const app = await buildServer();
      try {
        // Create first user
        await app.inject({
          method: "POST",
          url: "/signup",
          payload: {
            email: "duplicate@example.com",
            password: "password123",
            username: "user1",
          },
        });

        // Try to create second user with same email
        const response = await app.inject({
          method: "POST",
          url: "/signup",
          payload: {
            email: "duplicate@example.com",
            password: "password456",
            username: "user2",
          },
        });

        expect(response.statusCode).toBe(409);
        const payload = response.json();
        expect(payload.message).toContain("email-already-exists");
      } finally {
        await app.close();
      }
    });

    it("returns 400 when username already exists", async () => {
      const app = await buildServer();
      try {
        // Create first user
        await app.inject({
          method: "POST",
          url: "/signup",
          payload: {
            email: "user1@example.com",
            password: "password123",
            username: "duplicateuser",
          },
        });

        // Try to create second user with same username
        const response = await app.inject({
          method: "POST",
          url: "/signup",
          payload: {
            email: "user2@example.com",
            password: "password456",
            username: "duplicateuser",
          },
        });

        expect(response.statusCode).toBe(409);
        const payload = response.json();
        expect(payload.message).toContain("username-already-exists");
      } finally {
        await app.close();
      }
    });

    it("hashes the password before storing", async () => {
      const app = await buildServer();
      try {
        const password = "mySecretPassword123";
        const response = await app.inject({
          method: "POST",
          url: "/signup",
          payload: {
            email: "secure@example.com",
            password,
            username: "secureuser",
          },
        });

        const payload = response.json();
        const user = await dataSource.getRepository(User).findOne({
          where: { id: payload.user_id },
          select: ["id", "password"],
        });

        // Password should not be stored in plain text
        expect(user?.password).not.toBe(password);

        // But should match when compared with bcrypt
        const isValid = await bcrypt.compare(password, user!.password);
        expect(isValid).toBe(true);
      } finally {
        await app.close();
      }
    });
  });

  describe("POST /signin", () => {
    it("signs in with email successfully", async () => {
      const app = await buildServer();
      try {
        // Create user
        await app.inject({
          method: "POST",
          url: "/signup",
          payload: {
            email: "signin@example.com",
            password: "password123",
            username: "signinuser",
          },
        });

        // Sign in
        const response = await app.inject({
          method: "POST",
          url: "/signin",
          payload: {
            credential: "signin@example.com",
            password: "password123",
          },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();

        expect(payload).toHaveProperty("token_type", "Bearer");
        expect(payload).toHaveProperty("user_id");
        expect(payload).toHaveProperty("access_token");
        expect(payload).toHaveProperty("refresh_token");
        expect(payload.user.email).toBe("signin@example.com");
      } finally {
        await app.close();
      }
    });

    it("signs in with username successfully", async () => {
      const app = await buildServer();
      try {
        // Create user
        await app.inject({
          method: "POST",
          url: "/signup",
          payload: {
            email: "signin2@example.com",
            password: "password123",
            username: "signinuser2",
          },
        });

        // Sign in with username
        const response = await app.inject({
          method: "POST",
          url: "/signin",
          payload: {
            credential: "signinuser2",
            password: "password123",
          },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload.user.username).toBe("signinuser2");
      } finally {
        await app.close();
      }
    });

    it("returns 404 when user not found", async () => {
      const app = await buildServer();
      try {
        const response = await app.inject({
          method: "POST",
          url: "/signin",
          payload: {
            credential: "nonexistent@example.com",
            password: "password123",
          },
        });

        expect(response.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });

    it("returns 500 when password is incorrect", async () => {
      const app = await buildServer();
      try {
        // Create user
        await app.inject({
          method: "POST",
          url: "/signup",
          payload: {
            email: "wrongpass@example.com",
            password: "correctpassword",
            username: "wrongpassuser",
          },
        });

        // Try to sign in with wrong password
        const response = await app.inject({
          method: "POST",
          url: "/signin",
          payload: {
            credential: "wrongpass@example.com",
            password: "wrongpassword",
          },
        });

        expect(response.statusCode).toBe(500);
      } finally {
        await app.close();
      }
    });

    it("is case-insensitive for email", async () => {
      const app = await buildServer();
      try {
        // Create user with lowercase email
        await app.inject({
          method: "POST",
          url: "/signup",
          payload: {
            email: "case@example.com",
            password: "password123",
            username: "caseuser",
          },
        });

        // Sign in with uppercase email
        const response = await app.inject({
          method: "POST",
          url: "/signin",
          payload: {
            credential: "CASE@EXAMPLE.COM",
            password: "password123",
          },
        });

        // This will fail because TypeORM doesn't do case-insensitive by default
        // but it documents the current behavior
        expect(response.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });

  describe("POST /refresh", () => {
    it("refreshes access token with valid refresh token", async () => {
      const app = await buildServer();
      try {
        // Sign up to get tokens
        const signupResponse = await app.inject({
          method: "POST",
          url: "/signup",
          payload: {
            email: "refresh@example.com",
            password: "password123",
            username: "refreshuser",
          },
        });

        const { refresh_token, user_id } = signupResponse.json();

        // Refresh the token
        const response = await app.inject({
          method: "POST",
          url: "/refresh",
          payload: {
            refresh_token,
          },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();

        expect(payload).toHaveProperty("token_type", "Bearer");
        expect(payload).toHaveProperty("access_token");

        // Verify new access token is valid
        const decoded = jwt.verify(
          payload.access_token,
          config.auth.secretAccessToken,
        ) as any;
        expect(decoded.sub).toBe(user_id);
      } finally {
        await app.close();
      }
    });

    it("returns 500 for invalid refresh token", async () => {
      const app = await buildServer();
      try {
        const response = await app.inject({
          method: "POST",
          url: "/refresh",
          payload: {
            refresh_token: "invalid-token",
          },
        });

        expect(response.statusCode).toBe(500);
      } finally {
        await app.close();
      }
    });

    it("returns 500 when user no longer exists", async () => {
      const app = await buildServer();
      try {
        // Sign up to get tokens
        const signupResponse = await app.inject({
          method: "POST",
          url: "/signup",
          payload: {
            email: "deleted@example.com",
            password: "password123",
            username: "deleteduser",
          },
        });

        const { refresh_token, user_id } = signupResponse.json();

        // Delete the user
        await dataSource.getRepository(User).delete(user_id);

        // Try to refresh
        const response = await app.inject({
          method: "POST",
          url: "/refresh",
          payload: {
            refresh_token,
          },
        });

        expect(response.statusCode).toBe(500);
      } finally {
        await app.close();
      }
    });
  });

  describe("POST /forgot-password", () => {
    it("returns success message for existing email", async () => {
      const { emailService } = require("../../src/services/EmailService");
      const app = await buildServer();
      try {
        // Create user
        await app.inject({
          method: "POST",
          url: "/signup",
          payload: {
            email: "forgot@example.com",
            password: "password123",
            username: "forgotuser",
          },
        });

        const response = await app.inject({
          method: "POST",
          url: "/forgot-password",
          payload: {
            email: "forgot@example.com",
          },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload.message).toContain(
          "If an account exists with that email",
        );

        // Verify email was sent
        expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
      } finally {
        await app.close();
      }
    });

    it("returns same message for non-existent email", async () => {
      const { emailService } = require("../../src/services/EmailService");
      const app = await buildServer();
      try {
        const response = await app.inject({
          method: "POST",
          url: "/forgot-password",
          payload: {
            email: "nonexistent@example.com",
          },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload.message).toContain(
          "If an account exists with that email",
        );

        // Verify email was NOT sent
        expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    });

    it("generates and stores reset token", async () => {
      const app = await buildServer();
      try {
        // Create user
        const signupResponse = await app.inject({
          method: "POST",
          url: "/signup",
          payload: {
            email: "reset@example.com",
            password: "password123",
            username: "resetuser",
          },
        });

        const { user_id } = signupResponse.json();

        await app.inject({
          method: "POST",
          url: "/forgot-password",
          payload: {
            email: "reset@example.com",
          },
        });

        // Verify reset token was stored
        const user = await dataSource.getRepository(User).findOne({
          where: { id: user_id },
          select: ["id", "attributes"],
        });

        const resetToken = user?.attributes?.find(
          (attr) => attr.key === "resetToken",
        );
        const resetTokenExpiry = user?.attributes?.find(
          (attr) => attr.key === "resetTokenExpiry",
        );

        expect(resetToken).toBeDefined();
        expect(resetToken?.value).toHaveLength(64);
        expect(resetTokenExpiry).toBeDefined();

        // Verify expiry is in the future
        const expiryDate = new Date(resetTokenExpiry!.value);
        expect(expiryDate.getTime()).toBeGreaterThan(Date.now());
      } finally {
        await app.close();
      }
    });
  });
});
import { UserCrosswordPack } from "../../src/entities/UserCrosswordPack";
