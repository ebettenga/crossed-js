/**
 * AuthService Unit Tests
 *
 * Prerequisites:
 * - PostgreSQL must be running
 * - Database 'crossed_test' must exist on port 5433
 */

import { DataSource } from "typeorm";
import { User } from "../../src/entities/User";
import { GameStats } from "../../src/entities/GameStats";
import { Room } from "../../src/entities/Room";
import { Crossword } from "../../src/entities/Crossword";
import { Friend } from "../../src/entities/Friend";
import { AuthService } from "../../src/services/AuthService";
import { createPostgresTestManager } from "../utils/postgres";
import {
  ForbiddenError,
  NotFoundError,
  UniqueConstraintError,
} from "../../src/errors/api";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { config } from "../../src/config/config";

jest.setTimeout(60000);

// Mock email service
jest.mock("../../src/services/EmailService", () => ({
  emailService: {
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  },
}));

const postgres = createPostgresTestManager({
  label: "AuthService tests",
  entities: [User, GameStats, Room, Crossword, Friend],
  env: {
    database: ["AUTH_SERVICE_TEST_DB"],
    schema: ["AUTH_SERVICE_TEST_SCHEMA"],
    host: ["AUTH_SERVICE_TEST_DB_HOST"],
    port: ["AUTH_SERVICE_TEST_DB_PORT"],
    username: ["AUTH_SERVICE_TEST_DB_USER"],
    password: ["AUTH_SERVICE_TEST_DB_PASSWORD"],
  },
  defaults: {
    database: "crossed_test",
    schema: "auth_service_test",
    host: "127.0.0.1",
    port: 5433,
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
  "user",
];

let dataSource: DataSource;
let authService: AuthService;

const mockFastify = {
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
} as any;

beforeAll(async () => {
  await postgres.setup();
  dataSource = postgres.dataSource;
  authService = new AuthService(dataSource);
});

beforeEach(async () => {
  await postgres.truncate(TABLES_TO_TRUNCATE);
  jest.clearAllMocks();
});

afterAll(async () => {
  await postgres.close();
});

describe("AuthService", () => {
  describe("signup", () => {
    it("creates a new user successfully", async () => {
      const signupData = {
        email: "test@example.com",
        password: "password123",
        username: "testuser",
      };

      const result = await authService.signup(mockFastify, signupData);

      expect(result).toHaveProperty("token_type", "Bearer");
      expect(result).toHaveProperty("user_id");
      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
      expect(result).toHaveProperty("user");
      expect(result.user.email).toBe(signupData.email);
      expect(result.user.username).toBe(signupData.username);
      expect(result.user.roles).toEqual(["user"]);
      expect(result.user.confirmed_mail).toBe(false);

      // Verify password is hashed
      const user = await dataSource.getRepository(User).findOne({
        where: { id: result.user_id },
        select: ["id", "password"],
      });
      expect(user?.password).not.toBe(signupData.password);
      const isPasswordValid = await bcrypt.compare(
        signupData.password,
        user!.password,
      );
      expect(isPasswordValid).toBe(true);
    });

    it("throws error when email already exists", async () => {
      const signupData = {
        email: "duplicate@example.com",
        password: "password123",
        username: "user1",
      };

      await authService.signup(mockFastify, signupData);

      await expect(
        authService.signup(mockFastify, {
          email: "duplicate@example.com",
          password: "password456",
          username: "user2",
        }),
      ).rejects.toThrow(UniqueConstraintError);
    });

    it("throws error when username already exists", async () => {
      const signupData = {
        email: "user1@example.com",
        password: "password123",
        username: "duplicateuser",
      };

      await authService.signup(mockFastify, signupData);

      await expect(
        authService.signup(mockFastify, {
          email: "user2@example.com",
          password: "password456",
          username: "duplicateuser",
        }),
      ).rejects.toThrow(UniqueConstraintError);
    });

    it("throws error when both email and username already exist", async () => {
      const signupData = {
        email: "duplicate@example.com",
        password: "password123",
        username: "duplicateuser",
      };

      await authService.signup(mockFastify, signupData);

      await expect(
        authService.signup(mockFastify, signupData),
      ).rejects.toThrow(UniqueConstraintError);
    });

    it("generates valid JWT tokens", async () => {
      const signupData = {
        email: "jwt@example.com",
        password: "password123",
        username: "jwtuser",
      };

      const result = await authService.signup(mockFastify, signupData);

      // Verify access token
      const accessDecoded = jwt.verify(
        result.access_token,
        config.auth.secretAccessToken,
      ) as any;
      expect(accessDecoded.sub).toBe(result.user_id);
      expect(accessDecoded.roles).toEqual(["user"]);

      // Verify refresh token
      const refreshDecoded = jwt.verify(
        result.refresh_token,
        config.auth.secretAccessToken,
      ) as any;
      expect(refreshDecoded.sub).toBe(result.user_id);
      expect(refreshDecoded.aud).toBe("/refresh");
    });
  });

  describe("signin", () => {
    it("signs in with email successfully", async () => {
      const signupData = {
        email: "signin@example.com",
        password: "password123",
        username: "signinuser",
      };

      await authService.signup(mockFastify, signupData);

      const result = await authService.signin(mockFastify, {
        credential: signupData.email,
        password: signupData.password,
      });

      expect(result).toHaveProperty("token_type", "Bearer");
      expect(result).toHaveProperty("user_id");
      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
      expect(result.user.email).toBe(signupData.email);
    });

    it("signs in with username successfully", async () => {
      const signupData = {
        email: "signin2@example.com",
        password: "password123",
        username: "signinuser2",
      };

      await authService.signup(mockFastify, signupData);

      const result = await authService.signin(mockFastify, {
        credential: signupData.username,
        password: signupData.password,
      });

      expect(result).toHaveProperty("token_type", "Bearer");
      expect(result.user.username).toBe(signupData.username);
    });

    it("throws error when user not found", async () => {
      await expect(
        authService.signin(mockFastify, {
          credential: "nonexistent@example.com",
          password: "password123",
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws error when password is invalid", async () => {
      const signupData = {
        email: "wrongpass@example.com",
        password: "correctpassword",
        username: "wrongpassuser",
      };

      await authService.signup(mockFastify, signupData);

      await expect(
        authService.signin(mockFastify, {
          credential: signupData.email,
          password: "wrongpassword",
        }),
      ).rejects.toThrow("auth/invalid-password");
    });
  });

  describe("verify", () => {
    it("verifies a valid token", async () => {
      const signupData = {
        email: "verify@example.com",
        password: "password123",
        username: "verifyuser",
      };

      const { access_token, user_id } = await authService.signup(
        mockFastify,
        signupData,
      );

      const decoded = authService.verify(mockFastify, {
        token: access_token,
      }) as any;

      expect(decoded.sub).toBe(user_id);
      expect(decoded.roles).toEqual(["user"]);
    });

    it("throws error for invalid token", () => {
      expect(() => authService.verify(mockFastify, { token: "invalid-token" }))
        .toThrow(ForbiddenError);
    });

    it("throws error for expired token", () => {
      const expiredToken = jwt.sign(
        { sub: 1, roles: ["user"] },
        config.auth.secretAccessToken,
        { expiresIn: "-1h" },
      );

      expect(() => authService.verify(mockFastify, { token: expiredToken }))
        .toThrow(ForbiddenError);
    });
  });

  describe("refresh", () => {
    it("refreshes access token with valid refresh token", async () => {
      const signupData = {
        email: "refresh@example.com",
        password: "password123",
        username: "refreshuser",
      };

      const { refresh_token, user_id } = await authService.signup(
        mockFastify,
        signupData,
      );

      const result = await authService.refresh(mockFastify, { refresh_token });

      expect(result).toHaveProperty("token_type", "Bearer");
      expect(result).toHaveProperty("access_token");

      // Verify new access token
      const decoded = jwt.verify(
        result.access_token,
        config.auth.secretAccessToken,
      ) as any;
      expect(decoded.sub).toBe(user_id);
    });

    it("throws error for invalid refresh token", async () => {
      await expect(
        authService.refresh(mockFastify, { refresh_token: "invalid-token" }),
      ).rejects.toThrow("auth/invalid-refresh-token");
    });

    it("throws error when user no longer exists", async () => {
      const signupData = {
        email: "deleted@example.com",
        password: "password123",
        username: "deleteduser",
      };

      const { refresh_token, user_id } = await authService.signup(
        mockFastify,
        signupData,
      );

      // Delete the user
      await dataSource.getRepository(User).delete(user_id);

      await expect(
        authService.refresh(mockFastify, { refresh_token }),
      ).rejects.toThrow("auth/invalid-refresh-token");
    });
  });

  describe("forgotPassword", () => {
    it("generates reset token for existing user", async () => {
      const { emailService } = require("../../src/services/EmailService");

      const signupData = {
        email: "forgot@example.com",
        password: "password123",
        username: "forgotuser",
      };

      const { user_id } = await authService.signup(mockFastify, signupData);

      await authService.forgotPassword(signupData.email);

      // Verify reset token was saved
      const user = await dataSource.getRepository(User).findOne({
        where: { id: user_id },
        select: ["id", "attributes"],
      });

      const resetTokenAttr = user?.attributes?.find(
        (attr) => attr.key === "resetToken",
      );
      const resetTokenExpiryAttr = user?.attributes?.find(
        (attr) => attr.key === "resetTokenExpiry",
      );

      expect(resetTokenAttr).toBeDefined();
      expect(resetTokenExpiryAttr).toBeDefined();
      expect(resetTokenAttr?.value).toHaveLength(64); // 32 bytes hex = 64 chars

      // Verify email was sent
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        signupData.email,
        signupData.username,
        resetTokenAttr?.value,
      );
    });

    it("returns silently for non-existent email", async () => {
      const { emailService } = require("../../src/services/EmailService");

      await authService.forgotPassword("nonexistent@example.com");

      // Should not throw error and should not send email
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("replaces existing reset token", async () => {
      const signupData = {
        email: "replace@example.com",
        password: "password123",
        username: "replaceuser",
      };

      const { user_id } = await authService.signup(mockFastify, signupData);

      // Request password reset twice
      await authService.forgotPassword(signupData.email);
      const user1 = await dataSource.getRepository(User).findOne({
        where: { id: user_id },
        select: ["id", "attributes"],
      });
      const firstToken = user1?.attributes?.find(
        (attr) => attr.key === "resetToken",
      )?.value;

      await authService.forgotPassword(signupData.email);
      const user2 = await dataSource.getRepository(User).findOne({
        where: { id: user_id },
        select: ["id", "attributes"],
      });
      const secondToken = user2?.attributes?.find(
        (attr) => attr.key === "resetToken",
      )?.value;

      // Tokens should be different
      expect(firstToken).not.toBe(secondToken);

      // Should only have one reset token
      const resetTokens = user2?.attributes?.filter(
        (attr) => attr.key === "resetToken",
      );
      expect(resetTokens).toHaveLength(1);
    });
  });

  describe("updatePassword", () => {
    it("updates password successfully", async () => {
      const signupData = {
        email: "update@example.com",
        password: "oldpassword",
        username: "updateuser",
      };

      const { user_id } = await authService.signup(mockFastify, signupData);

      await authService.updatePassword(user_id, "newpassword");

      // Verify new password works
      const result = await authService.signin(mockFastify, {
        credential: signupData.email,
        password: "newpassword",
      });

      expect(result.user_id).toBe(user_id);

      // Verify old password doesn't work
      await expect(
        authService.signin(mockFastify, {
          credential: signupData.email,
          password: "oldpassword",
        }),
      ).rejects.toThrow("auth/invalid-password");
    });

    it("throws error when user not found", async () => {
      await expect(
        authService.updatePassword(99999, "newpassword"),
      ).rejects.toThrow(NotFoundError);
    });

    it("hashes the new password", async () => {
      const signupData = {
        email: "hash@example.com",
        password: "oldpassword",
        username: "hashuser",
      };

      const { user_id } = await authService.signup(mockFastify, signupData);

      const newPassword = "newpassword123";
      await authService.updatePassword(user_id, newPassword);

      const user = await dataSource.getRepository(User).findOne({
        where: { id: user_id },
        select: ["id", "password"],
      });

      // Password should be hashed, not plain text
      expect(user?.password).not.toBe(newPassword);

      // But should match when compared
      const isValid = await bcrypt.compare(newPassword, user!.password);
      expect(isValid).toBe(true);
    });
  });
});
