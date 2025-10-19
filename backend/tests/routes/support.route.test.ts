import Fastify from "fastify";
import { DataSource } from "typeorm";
import type { PluginDataSource } from "typeorm-fastify-plugin";
import { Support } from "../../src/entities/Support";
import { User } from "../../src/entities/User";
import { GameStats } from "../../src/entities/GameStats";
import { Room } from "../../src/entities/Room";
import { Crossword } from "../../src/entities/Crossword";
import { Friend } from "../../src/entities/Friend";
import supportRoutes from "../../src/routes/private/support";
import { createPostgresTestManager } from "../utils/postgres";
import { ensureApprovedSnapshot } from "../utils/approval";

jest.setTimeout(60000);

const postgres = createPostgresTestManager({
  label: "Support route tests",
  entities: [Support, User, GameStats, Room, Crossword, Friend],
  env: {
    database: [
      "SUPPORT_ROUTES_TEST_DB",
      "POSTGRES_DB",
    ],
    schema: [
      "SUPPORT_ROUTES_TEST_SCHEMA",
    ],
    host: [
      "SUPPORT_ROUTES_TEST_DB_HOST",
      "PGHOST",
    ],
    port: [
      "SUPPORT_ROUTES_TEST_DB_PORT",
      "PGPORT",
    ],
    username: [
      "SUPPORT_ROUTES_TEST_DB_USER",
      "PGUSER",
    ],
    password: [
      "SUPPORT_ROUTES_TEST_DB_PASSWORD",
      "PGPASSWORD",
    ],
  },
  defaults: {
    database: "crossed_test",
    schema: "support_route_test",
    host: "127.0.0.1",
    port: 5433,
    username: "postgres",
    password: "postgres",
  },
});

const TABLES_TO_TRUNCATE = [
  "support",
  "user",
];

let dataSource: DataSource;

const buildServer = async (user: User) => {
  const app = Fastify({ logger: false });

  app.decorate("orm", dataSource as unknown as PluginDataSource);
  app.decorateRequest("user", null);
  app.addHook("preHandler", (request, _reply, done) => {
    request.user = user;
    done();
  });

  supportRoutes(app as any, {}, () => {});
  await app.ready();
  return app;
};

const createUser = async (overrides: Partial<User> = {}) => {
  const repository = dataSource.getRepository(User);
  const user = repository.create({
    username: `user_${Math.random().toString(36).slice(2, 8)}`,
    email: `${Date.now()}-${Math.random()}@test.com`,
    password: "password",
    roles: overrides.roles ?? ["user"],
    status: "online",
    eloRating: 1200,
    ...overrides,
  });
  return repository.save(user);
};

const createSupportRequest = async (
  user: User,
  overrides: Partial<Support> = {},
): Promise<Support> => {
  const repository = dataSource.getRepository(Support);
  const support = repository.create({
    type: overrides.type ?? "support",
    comment: overrides.comment ?? "Test support request",
    user,
    userId: user.id,
    ...overrides,
  });
  return repository.save(support);
};

const sanitizeSupportRecord = (record: any) => ({
  id: record.id,
  type: record.type,
  comment: record.comment,
  userId: record.userId,
  username: record.user ? record.user.username : null,
  hasCreatedAt: Boolean(record.created_at),
});

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

describe("support routes", () => {
  describe("GET /support", () => {
    it("returns all support requests for admin users", async () => {
      const admin = await createUser({ username: "admin", roles: ["admin"] });
      const user1 = await createUser({ username: "user1" });
      const user2 = await createUser({ username: "user2" });

      await createSupportRequest(user1, {
        type: "support",
        comment: "I need help with my account",
      });
      await createSupportRequest(user2, {
        type: "suggestion",
        comment: "Add dark mode please",
      });
      await createSupportRequest(admin, {
        type: "support",
        comment: "Admin support request",
      });

      const app = await buildServer(admin);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/support",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as Array<any>;

        expect(payload).toHaveLength(3);
        const sanitized = payload
          .map(sanitizeSupportRecord)
          .sort((a, b) => a.id - b.id);

        await ensureApprovedSnapshot({
          testFile: expect.getState().testPath ?? "support.route.test.ts",
          snapshotName: "returns all support requests for admin users",
          received: sanitized,
        });
      } finally {
        await app.close();
      }
    });

    it("returns 403 for non-admin users", async () => {
      const user = await createUser({ username: "regular_user" });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/support",
        });

        expect(response.statusCode).toBe(403);
        const payload = response.json();
        expect(payload).toEqual({ error: "Unauthorized" });
      } finally {
        await app.close();
      }
    });

    it("returns empty array when no support requests exist", async () => {
      const admin = await createUser({ username: "admin", roles: ["admin"] });

      const app = await buildServer(admin);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/support",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload).toEqual([]);
      } finally {
        await app.close();
      }
    });

    it("orders support requests by created_at descending", async () => {
      const admin = await createUser({ username: "admin", roles: ["admin"] });
      const user1 = await createUser({ username: "user1" });

      const first = await createSupportRequest(user1, {
        comment: "First request",
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const second = await createSupportRequest(user1, {
        comment: "Second request",
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const third = await createSupportRequest(user1, {
        comment: "Third request",
      });

      const app = await buildServer(admin);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/support",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as Array<any>;

        expect(payload).toHaveLength(3);
        // Should be in reverse order (newest first)
        expect(payload[0].id).toBe(third.id);
        expect(payload[1].id).toBe(second.id);
        expect(payload[2].id).toBe(first.id);
      } finally {
        await app.close();
      }
    });

    it("includes user information in the response", async () => {
      const admin = await createUser({ username: "admin", roles: ["admin"] });
      const user1 = await createUser({ username: "testuser123" });

      await createSupportRequest(user1, {
        type: "support",
        comment: "Test request",
      });

      const app = await buildServer(admin);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/support",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as Array<any>;

        expect(payload).toHaveLength(1);
        expect(payload[0].user).toBeDefined();
        expect(payload[0].user.username).toBe("testuser123");
        expect(payload[0].user.id).toBe(user1.id);
      } finally {
        await app.close();
      }
    });
  });

  describe("GET /support/me", () => {
    it("returns only the authenticated user's support requests", async () => {
      const user1 = await createUser({ username: "user1" });
      const user2 = await createUser({ username: "user2" });

      await createSupportRequest(user1, {
        type: "support",
        comment: "My first request",
      });
      await createSupportRequest(user1, {
        type: "suggestion",
        comment: "My suggestion",
      });
      await createSupportRequest(user2, {
        type: "support",
        comment: "Other user's request",
      });

      const app = await buildServer(user1);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/support/me",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as Array<any>;

        expect(payload).toHaveLength(2);
        payload.forEach((item) => {
          expect(item.userId).toBe(user1.id);
        });

        const sanitized = payload
          .map(sanitizeSupportRecord)
          .sort((a, b) => a.id - b.id);

        await ensureApprovedSnapshot({
          testFile: expect.getState().testPath ?? "support.route.test.ts",
          snapshotName:
            "returns only the authenticated user's support requests",
          received: sanitized,
        });
      } finally {
        await app.close();
      }
    });

    it("returns empty array when user has no support requests", async () => {
      const user = await createUser({ username: "user_no_requests" });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/support/me",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload).toEqual([]);
      } finally {
        await app.close();
      }
    });

    it("orders support requests by created_at descending", async () => {
      const user = await createUser({ username: "user_ordering" });

      const first = await createSupportRequest(user, {
        comment: "First request",
      });
      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
      const second = await createSupportRequest(user, {
        comment: "Second request",
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const third = await createSupportRequest(user, {
        comment: "Third request",
      });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "GET",
          url: "/support/me",
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as Array<any>;

        expect(payload).toHaveLength(3);
        // Should be in reverse order (newest first)
        expect(payload[0].id).toBe(third.id);
        expect(payload[1].id).toBe(second.id);
        expect(payload[2].id).toBe(first.id);
      } finally {
        await app.close();
      }
    });
  });

  describe("POST /support", () => {
    it("creates a support request successfully", async () => {
      const user = await createUser({ username: "support_creator" });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "POST",
          url: "/support",
          payload: {
            type: "support",
            comment: "I need help with my account settings",
          },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as any;

        expect(payload.type).toBe("support");
        expect(payload.comment).toBe("I need help with my account settings");
        expect(payload.userId).toBe(user.id);
        expect(payload.id).toBeDefined();

        const sanitized = sanitizeSupportRecord(payload);
        await ensureApprovedSnapshot({
          testFile: expect.getState().testPath ?? "support.route.test.ts",
          snapshotName: "creates a support request successfully",
          received: sanitized,
        });

        // Verify it was saved to database
        const stored = await dataSource
          .getRepository(Support)
          .findOneByOrFail({ id: payload.id });
        expect(stored.type).toBe("support");
        expect(stored.comment).toBe("I need help with my account settings");
        expect(stored.userId).toBe(user.id);
      } finally {
        await app.close();
      }
    });

    it("creates a suggestion request successfully", async () => {
      const user = await createUser({ username: "suggestion_creator" });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "POST",
          url: "/support",
          payload: {
            type: "suggestion",
            comment: "Please add a feature to export game history",
          },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as any;

        expect(payload.type).toBe("suggestion");
        expect(payload.comment).toBe(
          "Please add a feature to export game history",
        );
        expect(payload.userId).toBe(user.id);

        const sanitized = sanitizeSupportRecord(payload);
        await ensureApprovedSnapshot({
          testFile: expect.getState().testPath ?? "support.route.test.ts",
          snapshotName: "creates a suggestion request successfully",
          received: sanitized,
        });
      } finally {
        await app.close();
      }
    });

    it("returns 400 when type is missing", async () => {
      const user = await createUser({ username: "missing_type" });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "POST",
          url: "/support",
          payload: {
            comment: "This is missing a type",
          },
        });

        expect(response.statusCode).toBe(400);
        const payload = response.json();
        expect(payload).toEqual({ error: "Type and comment are required" });
      } finally {
        await app.close();
      }
    });

    it("returns 400 when comment is missing", async () => {
      const user = await createUser({ username: "missing_comment" });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "POST",
          url: "/support",
          payload: {
            type: "support",
          },
        });

        expect(response.statusCode).toBe(400);
        const payload = response.json();
        expect(payload).toEqual({ error: "Type and comment are required" });
      } finally {
        await app.close();
      }
    });

    it("returns 400 when both type and comment are missing", async () => {
      const user = await createUser({ username: "missing_both" });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "POST",
          url: "/support",
          payload: {},
        });

        expect(response.statusCode).toBe(400);
        const payload = response.json();
        expect(payload).toEqual({ error: "Type and comment are required" });
      } finally {
        await app.close();
      }
    });

    it("returns 400 when type is empty string", async () => {
      const user = await createUser({ username: "empty_type" });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "POST",
          url: "/support",
          payload: {
            type: "",
            comment: "Valid comment",
          },
        });

        expect(response.statusCode).toBe(400);
        const payload = response.json();
        expect(payload).toEqual({ error: "Type and comment are required" });
      } finally {
        await app.close();
      }
    });

    it("returns 400 when comment is empty string", async () => {
      const user = await createUser({ username: "empty_comment" });

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "POST",
          url: "/support",
          payload: {
            type: "support",
            comment: "",
          },
        });

        expect(response.statusCode).toBe(400);
        const payload = response.json();
        expect(payload).toEqual({ error: "Type and comment are required" });
      } finally {
        await app.close();
      }
    });

    it("handles long comments correctly", async () => {
      const user = await createUser({ username: "long_comment_user" });
      const longComment = "A".repeat(1000);

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "POST",
          url: "/support",
          payload: {
            type: "support",
            comment: longComment,
          },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as any;

        expect(payload.comment).toBe(longComment);
        expect(payload.comment.length).toBe(1000);
      } finally {
        await app.close();
      }
    });

    it("handles special characters in comments", async () => {
      const user = await createUser({ username: "special_chars_user" });
      const specialComment =
        "Test with special chars: <script>alert('xss')</script> & \"quotes\" 'single' 日本語";

      const app = await buildServer(user);
      try {
        const response = await app.inject({
          method: "POST",
          url: "/support",
          payload: {
            type: "suggestion",
            comment: specialComment,
          },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json() as any;

        expect(payload.comment).toBe(specialComment);
      } finally {
        await app.close();
      }
    });
  });
});
