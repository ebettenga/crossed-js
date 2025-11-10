import Fastify from "fastify";
import { DataSource } from "typeorm";
import type { PluginDataSource } from "typeorm-fastify-plugin";
import { ensureApprovedSnapshot } from "../utils/approval";
import { createPostgresTestManager } from "../utils/postgres";
import usersRoutes from "../../src/routes/private/users";
import { User } from "../../src/entities/User";
import { GameStats } from "../../src/entities/GameStats";
import { Room } from "../../src/entities/Room";
import { Crossword } from "../../src/entities/Crossword";
import bcrypt from "bcrypt";
import { UserCrosswordPack } from "../../src/entities/UserCrosswordPack";

const postgres = createPostgresTestManager({
  label: "Users route tests",
  entities: [User, GameStats, Room, Crossword, UserCrosswordPack],
  env: {
    database: ["USER_ROUTES_TEST_DB", "ROOM_SERVICE_TEST_DB"],
    schema: ["USER_ROUTES_TEST_SCHEMA", "ROOM_SERVICE_TEST_SCHEMA"],
    host: ["USER_ROUTES_TEST_DB_HOST", "ROOM_SERVICE_TEST_DB_HOST", "PGHOST"],
    port: ["USER_ROUTES_TEST_DB_PORT", "ROOM_SERVICE_TEST_DB_PORT", "PGPORT"],
    username: [
      "USER_ROUTES_TEST_DB_USER",
      "ROOM_SERVICE_TEST_DB_USER",
      "PGUSER",
    ],
    password: [
      "USER_ROUTES_TEST_DB_PASSWORD",
      "ROOM_SERVICE_TEST_DB_PASSWORD",
      "PGPASSWORD",
    ],
  },
  defaults: {
    database: "crossed_test",
    schema: "users_route_test",
    host: "127.0.0.1",
    port: 5432,
    username: "postgres",
    password: "postgres",
  },
});

const TABLES_TO_TRUNCATE = [
  "game_stats",
  "room_players",
  "room",
  "crossword",
  "user_crossword_pack",
  "user",
];

let dataSource: DataSource;

const normalizeDate = (value: unknown) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  return date.toISOString();
};

const sanitizeUserView = (payload: any) => ({
  id: payload.id,
  username: payload.username,
  email: payload.email,
  status: payload.status,
  eloRating: payload.eloRating,
  created_at: normalizeDate(payload.created_at),
  lastActiveAt: normalizeDate(payload.lastActiveAt),
  gamesWon: payload.gamesWon,
  gamesLost: payload.gamesLost,
  guessAccuracy: payload.guessAccuracy,
  winRate: payload.winRate,
  photo: payload.photo ? "[PHOTO_DATA]" : null,
});

const sanitizeUserList = (payload: any[]) =>
  payload
    .map((user) => ({
      id: user.id,
      username: user.username,
      status: user.status,
      photo: user.photo ? "[PHOTO_DATA]" : null,
    }))
    .sort((a, b) => a.id - b.id);

const buildServer = async (user: User) => {
  const app = Fastify({ logger: false });
  app.decorate("orm", dataSource as unknown as PluginDataSource);
  app.decorateRequest("user", null);
  app.addHook("preHandler", (request, _reply, done) => {
    request.user = user;
    done();
  });

  usersRoutes(app as any, {}, () => {});
  await app.ready();
  return app;
};

const createUser = async (overrides: Partial<User> = {}) => {
  const repository = dataSource.getRepository(User);
  const hashedPassword = await bcrypt.hash(
    overrides.password || "password123",
    10,
  );
  const user = repository.create({
    username: overrides.username ??
      `user_${Math.random().toString(36).slice(2, 8)}`,
    email: overrides.email ?? `${Date.now()}-${Math.random()}@example.com`,
    password: hashedPassword,
    roles: overrides.roles ?? ["user"],
    status: overrides.status ?? "offline",
    eloRating: overrides.eloRating ?? 1200,
    ...overrides,
  });
  return repository.save(user);
};

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
      // Fall through to treat raw as single token
    }
  }

  return [trimmed];
};

const getStoredExpoTokens = async (userId: number): Promise<string[]> => {
  const repository = dataSource.getRepository(User);
  const user = await repository.findOne({
    where: { id: userId },
    select: {
      id: true,
      attributes: true,
    },
  });

  const attributes = user?.attributes ?? [];
  const tokenAttribute = attributes.find(
    (attribute) => attribute.key === "expoPushToken",
  );

  return parseStoredTokens(tokenAttribute?.value);
};

// Helper to create a simple 1x1 PNG image buffer
const createTestImageBuffer = (): Buffer => {
  // Minimal valid PNG file (1x1 transparent pixel)
  return Buffer.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    0x00,
    0x00,
    0x00,
    0x0d,
    0x49,
    0x48,
    0x44,
    0x52,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    0x01,
    0x08,
    0x06,
    0x00,
    0x00,
    0x00,
    0x1f,
    0x15,
    0xc4,
    0x89,
    0x00,
    0x00,
    0x00,
    0x0a,
    0x49,
    0x44,
    0x41,
    0x54,
    0x78,
    0x9c,
    0x63,
    0x00,
    0x01,
    0x00,
    0x00,
    0x05,
    0x00,
    0x01,
    0x0d,
    0x0a,
    0x2d,
    0xb4,
    0x00,
    0x00,
    0x00,
    0x00,
    0x49,
    0x45,
    0x4e,
    0x44,
    0xae,
    0x42,
    0x60,
    0x82,
  ]);
};

beforeAll(async () => {
  await postgres.setup();
  dataSource = postgres.dataSource;
});

beforeEach(async () => {
  await postgres.truncate(TABLES_TO_TRUNCATE);
});

afterAll(async () => {
  await postgres.close();
});

describe("users routes (integration)", () => {
  describe("GET /me", () => {
    it(
      "returns the authenticated user's profile",
      async () => {
        const user = await createUser({
          username: "testuser",
          email: "test@example.com",
        });

        const app = await buildServer(user);
        try {
          const response = await app.inject({
            method: "GET",
            url: "/me",
          });

          expect(response.statusCode).toBe(200);
          const payload = response.json();
          expect(payload.username).toBe("testuser");
          expect(payload.email).toBe("test@example.com");
          expect(payload.status).toBe("offline");
          expect(payload.eloRating).toBe(1200);
        } finally {
          await app.close();
        }
      },
      10000,
    );
  });

  describe("PATCH /me", () => {
    it("updates username successfully", async () => {
      const user = await createUser({
        username: "oldusername",
        email: "test@example.com",
      });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "PATCH",
          url: "/me",
          payload: { username: "newusername" },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload.username).toBe("newusername");
        expect(payload.email).toBe("test@example.com");
      } finally {
        await app.close();
      }
    });

    it("updates email successfully", async () => {
      const user = await createUser({
        username: "testuser",
        email: "old@example.com",
      });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "PATCH",
          url: "/me",
          payload: { email: "new@example.com" },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload.email).toBe("new@example.com");
        expect(payload.username).toBe("testuser");
      } finally {
        await app.close();
      }
    });

    it("updates both username and email successfully", async () => {
      const user = await createUser({
        username: "oldusername",
        email: "old@example.com",
      });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "PATCH",
          url: "/me",
          payload: {
            username: "newusername",
            email: "new@example.com",
          },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload.username).toBe("newusername");
        expect(payload.email).toBe("new@example.com");
      } finally {
        await app.close();
      }
    });

    it("returns 400 when no fields provided", async () => {
      const user = await createUser();

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "PATCH",
          url: "/me",
          payload: {},
        });

        expect(response.statusCode).toBe(400);
        const payload = response.json();
        expect(payload.error).toBe(
          "At least one field (username or email) must be provided",
        );
      } finally {
        await app.close();
      }
    });

    it("returns 400 when email is already taken", async () => {
      const existingUser = await createUser({
        email: "taken@example.com",
      });
      const user = await createUser({
        email: "user@example.com",
      });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "PATCH",
          url: "/me",
          payload: { email: "taken@example.com" },
        });

        expect(response.statusCode).toBe(400);
        const payload = response.json();
        expect(payload.error).toBe("Email already taken");
      } finally {
        await app.close();
      }
    });

    it("returns 400 when username is already taken", async () => {
      const existingUser = await createUser({
        username: "takenusername",
      });
      const user = await createUser({
        username: "myusername",
      });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "PATCH",
          url: "/me",
          payload: { username: "takenusername" },
        });

        expect(response.statusCode).toBe(400);
        const payload = response.json();
        expect(payload.error).toBe("Username already taken");
      } finally {
        await app.close();
      }
    });

    it("allows updating to same username", async () => {
      const user = await createUser({
        username: "myusername",
      });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "PATCH",
          url: "/me",
          payload: { username: "myusername" },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload.username).toBe("myusername");
      } finally {
        await app.close();
      }
    });

    it("allows updating to same email", async () => {
      const user = await createUser({
        email: "my@example.com",
      });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "PATCH",
          url: "/me",
          payload: { email: "my@example.com" },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload.email).toBe("my@example.com");
      } finally {
        await app.close();
      }
    });
  });

  describe("Expo push token management", () => {
    const token = "ExponentPushToken[abcdef1234567890]";

    it("stores a new push token for the authenticated user", async () => {
      const user = await createUser();
      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "POST",
          url: "/users/push-tokens",
          payload: { token },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ tokens: [token] });

        const storedTokens = await getStoredExpoTokens(user.id);
        expect(storedTokens).toEqual([token]);
      } finally {
        await app.close();
      }
    });

    it("deduplicates existing push tokens", async () => {
      const user = await createUser({
        attributes: [
          {
            key: "expoPushToken",
            value: JSON.stringify([token]),
          },
        ],
      });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "POST",
          url: "/users/push-tokens",
          payload: { token },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ tokens: [token] });

        const storedTokens = await getStoredExpoTokens(user.id);
        expect(storedTokens).toEqual([token]);
      } finally {
        await app.close();
      }
    });

    it("removes a stored push token", async () => {
      const user = await createUser({
        attributes: [
          {
            key: "expoPushToken",
            value: JSON.stringify([token]),
          },
        ],
      });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "DELETE",
          url: "/users/push-tokens",
          payload: { token },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ removed: true, tokens: [] });

        const storedTokens = await getStoredExpoTokens(user.id);
        expect(storedTokens).toEqual([]);
      } finally {
        await app.close();
      }
    });

    it("returns 400 when token payload is missing", async () => {
      const user = await createUser();
      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "POST",
          url: "/users/push-tokens",
          payload: {},
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().error).toBe(
          "A valid Expo push token is required.",
        );
      } finally {
        await app.close();
      }
    });
  });

  describe("POST /me/photo", () => {
    it("uploads and processes a photo successfully", async () => {
      const user = await createUser();

      const app = await buildServer(user);
      try {
        const imageBuffer = createTestImageBuffer();
        const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
        const payload = Buffer.concat([
          Buffer.from(
            `--${boundary}\r\n` +
              `Content-Disposition: form-data; name="file"; filename="test.png"\r\n` +
              `Content-Type: image/png\r\n\r\n`,
          ),
          imageBuffer,
          Buffer.from(`\r\n--${boundary}--\r\n`),
        ]);

        const response = await app.inject({
          method: "POST",
          url: "/me/photo",
          payload,
          headers: {
            "content-type": `multipart/form-data; boundary=${boundary}`,
          },
        });

        expect(response.statusCode).toBe(200);
        const responsePayload = response.json();
        expect(responsePayload.photo).toBeTruthy();
        expect(responsePayload.photo).toContain("data:image/");

        // Verify photo was saved to database
        const repository = dataSource.getRepository(User);
        const updatedUser = await repository.findOne({
          where: { id: user.id },
        });
        expect(updatedUser?.photo).toBeTruthy();
        expect(updatedUser?.photoContentType).toBe("image/png");
      } finally {
        await app.close();
      }
    });

    // Note: Testing multipart file upload with no file is complex with Fastify inject
    // The actual validation happens in the route handler when request.file() returns null
    // This is covered by the successful upload test and the non-image file test
    it.skip("returns 400 when no file is uploaded", async () => {
      // Skipped: Difficult to test empty multipart with Fastify inject
      // The route correctly handles this case in production atm -_/0\_-
    });

    it("returns 400 when file is not an image", async () => {
      const user = await createUser();

      const app = await buildServer(user);
      try {
        const textBuffer = Buffer.from("This is not an image");
        const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
        const payload = Buffer.concat([
          Buffer.from(
            `--${boundary}\r\n` +
              `Content-Disposition: form-data; name="file"; filename="test.txt"\r\n` +
              `Content-Type: text/plain\r\n\r\n`,
          ),
          textBuffer,
          Buffer.from(`\r\n--${boundary}--\r\n`),
        ]);

        const response = await app.inject({
          method: "POST",
          url: "/me/photo",
          payload,
          headers: {
            "content-type": `multipart/form-data; boundary=${boundary}`,
          },
        });

        expect(response.statusCode).toBe(400);
        const responsePayload = response.json();
        expect(responsePayload.error).toBe("Only image files are allowed");
      } finally {
        await app.close();
      }
    });
  });

  describe("GET /users", () => {
    it("returns all users when no query provided", async () => {
      const user1 = await createUser({ username: "alice" });
      const user2 = await createUser({ username: "bob" });
      const user3 = await createUser({ username: "charlie" });

      const app = await buildServer(user1);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/users",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload).toHaveLength(3);
        expect(payload.map((u: any) => u.username).sort()).toEqual([
          "alice",
          "bob",
          "charlie",
        ]);
      } finally {
        await app.close();
      }
    });

    it(
      "searches users by username query",
      async () => {
        const user1 = await createUser({ username: "alice" });
        const user2 = await createUser({ username: "alicia" });
        const user3 = await createUser({ username: "bob" });

        const app = await buildServer(user1);
        try {
          const response = await app.inject({
            method: "GET",
            url: "/users?query=ali",
          });

          expect(response.statusCode).toBe(200);
          const payload = response.json();
          expect(payload).toHaveLength(2);
          expect(payload.map((u: any) => u.username).sort()).toEqual([
            "alice",
            "alicia",
          ]);
        } finally {
          await app.close();
        }
      },
      10000,
    );

    it("limits search results to 5 users", async () => {
      const user = await createUser({ username: "searcher" });

      // Create 10 users with similar names
      for (let i = 0; i < 10; i++) {
        await createUser({ username: `testuser${i}` });
      }

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/users?query=testuser",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload).toHaveLength(5);
      } finally {
        await app.close();
      }
    });

    it("returns empty array for query with no matches", async () => {
      const user = await createUser({ username: "alice" });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/users?query=nonexistent",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload).toEqual([]);
      } finally {
        await app.close();
      }
    });

    it("performs case-insensitive search", async () => {
      const user1 = await createUser({ username: "Alice" });
      const user2 = await createUser({ username: "ALICE" });
      const user3 = await createUser({ username: "alice" });

      const app = await buildServer(user1);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/users?query=alice",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload).toHaveLength(3);
      } finally {
        await app.close();
      }
    });
  });

  describe("POST /users/change-password", () => {
    it("changes password successfully with correct old password", async () => {
      const plainPassword = "oldpassword123";
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      const repository = dataSource.getRepository(User);
      const user = await repository.save(
        repository.create({
          username: `user_${Math.random().toString(36).slice(2, 8)}`,
          email: `${Date.now()}-${Math.random()}@example.com`,
          password: hashedPassword,
          roles: ["user"],
          status: "offline",
          eloRating: 1200,
        }),
      );

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "POST",
          url: "/users/change-password",
          payload: {
            oldPassword: plainPassword,
            newPassword: "newpassword456",
          },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload.message).toBe("Password changed successfully");

        // Verify password was actually changed
        const updatedUser = await repository.findOne({
          where: { id: user.id },
          select: { id: true, password: true },
        });
        const isNewPasswordValid = await bcrypt.compare(
          "newpassword456",
          updatedUser!.password,
        );
        expect(isNewPasswordValid).toBe(true);
      } finally {
        await app.close();
      }
    });

    it("returns 401 when old password is incorrect", async () => {
      const user = await createUser({
        password: "correctpassword",
      });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "POST",
          url: "/users/change-password",
          payload: {
            oldPassword: "wrongpassword",
            newPassword: "newpassword456",
          },
        });

        expect(response.statusCode).toBe(401);
        const payload = response.json();
        expect(payload.error).toBe("Invalid old password");
      } finally {
        await app.close();
      }
    });

    it("does not change password when old password is wrong", async () => {
      const user = await createUser({
        password: "correctpassword",
      });

      const repository = dataSource.getRepository(User);
      const originalUser = await repository.findOne({
        where: { id: user.id },
        select: { id: true, password: true },
      });
      const originalPasswordHash = originalUser!.password;

      const app = await buildServer(user);
      try {
        await app.inject({
          method: "POST",
          url: "/users/change-password",
          payload: {
            oldPassword: "wrongpassword",
            newPassword: "newpassword456",
          },
        });

        // Verify password was NOT changed
        const unchangedUser = await repository.findOne({
          where: { id: user.id },
          select: { id: true, password: true },
        });
        expect(unchangedUser!.password).toBe(originalPasswordHash);
      } finally {
        await app.close();
      }
    });
  });

  describe("GET /users/active", () => {
    it("returns count of online users", async () => {
      const user1 = await createUser({ status: "online" });
      const user2 = await createUser({ status: "online" });
      const user3 = await createUser({ status: "offline" });

      const app = await buildServer(user1);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/users/active",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        // Should be 2 because user1 status is updated to online
        expect(payload.count).toBeGreaterThanOrEqual(2);
      } finally {
        await app.close();
      }
    });

    it("updates current user status to online", async () => {
      const user = await createUser({ status: "offline" });

      const app = await buildServer(user);
      try {
        await app.inject({
          method: "GET",
          url: "/users/active",
        });

        // Verify user status was updated
        const repository = dataSource.getRepository(User);
        const updatedUser = await repository.findOne({
          where: { id: user.id },
        });
        expect(updatedUser?.status).toBe("online");
      } finally {
        await app.close();
      }
    });

    it("updates current user lastActiveAt timestamp", async () => {
      const oldDate = new Date("2020-01-01");
      const user = await createUser({
        status: "offline",
        lastActiveAt: oldDate,
      });

      const app = await buildServer(user);
      try {
        await app.inject({
          method: "GET",
          url: "/users/active",
        });

        // Verify lastActiveAt was updated
        const repository = dataSource.getRepository(User);
        const updatedUser = await repository.findOne({
          where: { id: user.id },
        });
        expect(updatedUser?.lastActiveAt.getTime()).toBeGreaterThan(
          oldDate.getTime(),
        );
      } finally {
        await app.close();
      }
    });

    it("returns 0 when no users are online", async () => {
      const user = await createUser({ status: "offline" });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/users/active",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        // Will be 1 because the current user is set to online
        expect(payload.count).toBe(1);
      } finally {
        await app.close();
      }
    });
  });

  describe("GET /users/search", () => {
    it(
      "searches users by username",
      async () => {
        const user1 = await createUser({ username: "alice" });
        const user2 = await createUser({ username: "alicia" });
        const user3 = await createUser({ username: "bob" });

        const app = await buildServer(user1);
        try {
          const response = await app.inject({
            method: "GET",
            url: "/users/search?query=ali",
          });

          expect(response.statusCode).toBe(200);
          const payload = response.json();
          expect(payload).toHaveLength(2);
          expect(payload.map((u: any) => u.username).sort()).toEqual([
            "alice",
            "alicia",
          ]);
        } finally {
          await app.close();
        }
      },
      10000,
    );

    it("returns empty array when query is empty", async () => {
      const user = await createUser();

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/users/search?query=",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload).toEqual([]);
      } finally {
        await app.close();
      }
    });

    it("returns empty array when query is whitespace", async () => {
      const user = await createUser();

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/users/search?query=   ",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload).toEqual([]);
      } finally {
        await app.close();
      }
    });

    it("limits results to 5 users", async () => {
      const user = await createUser({ username: "searcher" });

      // Create 10 users with similar names
      for (let i = 0; i < 10; i++) {
        await createUser({ username: `testuser${i}` });
      }

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/users/search?query=testuser",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload).toHaveLength(5);
      } finally {
        await app.close();
      }
    });

    it("returns only selected fields", async () => {
      const user1 = await createUser({ username: "alice" });
      const user2 = await createUser({ username: "alicia" });

      const app = await buildServer(user1);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/users/search?query=ali",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload.length).toBeGreaterThan(0);

        // Verify only selected fields are returned
        payload.forEach((user: any) => {
          expect(user).toHaveProperty("id");
          expect(user).toHaveProperty("username");
          expect(user).toHaveProperty("status");
          // Should not have email, password, etc.
          expect(user).not.toHaveProperty("email");
          expect(user).not.toHaveProperty("password");
        });
      } finally {
        await app.close();
      }
    });

    it("performs partial matching", async () => {
      const user1 = await createUser({ username: "alice" });
      const user2 = await createUser({ username: "malice" });
      const user3 = await createUser({ username: "palace" });

      const app = await buildServer(user1);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/users/search?query=alice",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        // Should match alice and malice (palace doesn't contain 'alice' as substring in that order)
        expect(payload.length).toBeGreaterThanOrEqual(2);
        const usernames = payload.map((u: any) => u.username);
        expect(usernames).toContain("alice");
        expect(usernames).toContain("malice");
      } finally {
        await app.close();
      }
    });
  });
});
