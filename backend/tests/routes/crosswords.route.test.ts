import Fastify from "fastify";
import { DataSource } from "typeorm";
import type { PluginDataSource } from "typeorm-fastify-plugin";
import { Crossword } from "../../src/entities/Crossword";
import { CrosswordRating } from "../../src/entities/CrosswordRating";
import { User } from "../../src/entities/User";
import { GameStats } from "../../src/entities/GameStats";
import { Room } from "../../src/entities/Room";
import crosswordsRoutes from "../../src/routes/private/crosswords";
import { ensureApprovedSnapshot } from "../utils/approval";
import { createPostgresTestManager } from "../utils/postgres";
import { UserCrosswordPack } from "../../src/entities/UserCrosswordPack";

process.on("unhandledRejection", (reason) => {
  console.error(
    "Unhandled rejection in tests/routes/crosswords.route.test.ts:",
    reason,
  );
});

const postgres = createPostgresTestManager({
  label: "Crosswords route tests",
  entities: [
    Crossword,
    CrosswordRating,
    User,
    GameStats,
    Room,
    UserCrosswordPack,
  ],
  env: {
    database: [
      "CROSSWORDS_ROUTE_TEST_DB",
      "CROSSWORD_SERVICE_TEST_DB",
      "ROOM_SERVICE_TEST_DB",
      "POSTGRES_DB",
    ],
    schema: [
      "CROSSWORDS_ROUTE_TEST_SCHEMA",
      "CROSSWORD_SERVICE_TEST_SCHEMA",
      "ROOM_SERVICE_TEST_SCHEMA",
    ],
    host: [
      "CROSSWORDS_ROUTE_TEST_DB_HOST",
      "CROSSWORD_SERVICE_TEST_DB_HOST",
      "ROOM_SERVICE_TEST_DB_HOST",
      "PGHOST",
    ],
    port: [
      "CROSSWORDS_ROUTE_TEST_DB_PORT",
      "CROSSWORD_SERVICE_TEST_DB_PORT",
      "ROOM_SERVICE_TEST_DB_PORT",
      "PGPORT",
    ],
    username: [
      "CROSSWORDS_ROUTE_TEST_DB_USER",
      "CROSSWORD_SERVICE_TEST_DB_USER",
      "ROOM_SERVICE_TEST_DB_USER",
      "PGUSER",
    ],
    password: [
      "CROSSWORDS_ROUTE_TEST_DB_PASSWORD",
      "CROSSWORD_SERVICE_TEST_DB_PASSWORD",
      "ROOM_SERVICE_TEST_DB_PASSWORD",
      "PGPASSWORD",
    ],
  },
  defaults: {
    database: "crossed_test",
    schema: "crosswords_route_test",
    host: "127.0.0.1",
    port: 5432,
    username: "postgres",
    password: "postgres",
  },
});

const TABLES_TO_TRUNCATE = [
  "room_players",
  "game_stats",
  "crossword_rating",
  "crossword",
  "room",
  "user_crossword_pack",
  "user",
];

let dataSource: DataSource;

const normalizeDate = (value: unknown): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return date.toISOString();
};

const sanitizeCrosswordList = (payload: any) => ({
  page: payload.page,
  limit: payload.limit,
  total: payload.total,
  items: [...payload.items]
    .map((item: any) => ({
      id: item.id,
      title: item.title,
      dow: item.dow,
      col_size: item.col_size,
      row_size: item.row_size,
      date: normalizeDate(item.date),
    }))
    .sort((a, b) => a.id - b.id),
});

const sanitizeRatingResponse = (payload: any) => ({
  success: payload.success,
  rating: {
    id: payload.rating.id,
    userId: payload.rating.userId,
    crosswordId: payload.rating.crosswordId,
    difficultyRating: payload.rating.difficultyRating ?? null,
    qualityRating: payload.rating.qualityRating ?? null,
    created_at: payload.rating.created_at ? "[timestamp]" : null,
    updated_at: payload.rating.updated_at ? "[timestamp]" : null,
    user: payload.rating.user
      ? {
        id: payload.rating.user.id,
        username: payload.rating.user.username,
        email: payload.rating.user.email,
        roles: payload.rating.user.roles,
        status: payload.rating.user.status,
        eloRating: payload.rating.user.eloRating,
      }
      : null,
  },
});

const buildServer = async (user?: Partial<User>) => {
  const app = Fastify({ logger: false });

  app.decorate("orm", dataSource as unknown as PluginDataSource);
  app.decorateRequest("user", null);

  if (user) {
    app.addHook("preHandler", (request, _reply, done) => {
      request.user = user as any;
      done();
    });
  }

  crosswordsRoutes(app as any, {}, () => {});
  await app.ready();
  return app;
};

const createCrossword = async (overrides: Partial<Crossword> = {}) => {
  const repository = dataSource.getRepository(Crossword);
  const crossword = repository.create({
    clues: { across: [], down: [] },
    answers: { across: [], down: [] },
    author: "Test Author",
    created_by: "Tester",
    creator_link: "https://example.com",
    circles: [],
    date: new Date("2024-01-01T00:00:00.000Z"),
    dow: "Monday",
    grid: Array(16).fill("A"),
    gridnums: [],
    shadecircles: false,
    col_size: 4,
    row_size: 4,
    jnote: "Test jnote",
    notepad: "Test notepad",
    title: "Sample Crossword",
    pack: "general",
    ...overrides,
  });
  return repository.save(crossword);
};

const createUser = async (overrides: Partial<User> = {}) => {
  const repository = dataSource.getRepository(User);
  const user = repository.create({
    username: "tester",
    email: "tester@example.com",
    password: "password",
    roles: ["user"],
    status: "online",
    eloRating: 1200,
    ...overrides,
  });
  return repository.save(user);
};

const createRating = async (overrides: Partial<CrosswordRating>) => {
  const repository = dataSource.getRepository(CrosswordRating);
  const rating = repository.create(overrides);
  return repository.save(rating);
};

beforeAll(async () => {
  try {
    await postgres.setup();
    dataSource = postgres.dataSource;
  } catch (error) {
    console.error("Failed to initialise Crosswords route tests:", error);
    throw error;
  }
});

beforeEach(async () => {
  try {
    await postgres.truncate(TABLES_TO_TRUNCATE);
  } catch (error) {
    console.error(
      "Failed to truncate tables for Crosswords route tests:",
      error,
    );
    throw error;
  }
});

afterAll(async () => {
  await postgres.close();
});

describe("crosswords routes (integration)", () => {
  it("lists crosswords with defaults", async () => {
    let app: Awaited<ReturnType<typeof buildServer>> | undefined;
    try {
      await createCrossword({
        title: "Monday Mini",
        dow: "Monday",
        date: new Date("2023-12-31T00:00:00.000Z"),
        col_size: 4,
        row_size: 4,
        grid: Array(16).fill("M"),
      });
      await createCrossword({
        title: "Tuesday Standard",
        dow: "Tuesday",
        date: new Date("2024-01-01T00:00:00.000Z"),
        col_size: 5,
        row_size: 5,
        grid: Array(25).fill("T"),
      });
      await createCrossword({
        title: "Wednesday Challenge",
        dow: "Wednesday",
        date: new Date("2024-01-02T00:00:00.000Z"),
        col_size: 6,
        row_size: 6,
        grid: Array(36).fill("W"),
      });

      app = await buildServer();
      const response = await app.inject({
        method: "GET",
        url: "/crosswords",
      });

      expect(response.statusCode).toBe(200);
      const sanitized = sanitizeCrosswordList(response.json());
      console.log("lists crosswords sanitized:", sanitized);

      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "crosswords.route.test.ts",
        snapshotName: "lists crosswords with defaults",
        received: sanitized,
      });
    } catch (error) {
      if (error instanceof AggregateError) {
        console.error("lists crosswords AggregateError details:", error.errors);
      } else {
        console.error("lists crosswords error:", error);
      }
      throw error;
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it("filters crosswords by query parameters", async () => {
    let app: Awaited<ReturnType<typeof buildServer>> | undefined;
    try {
      await createCrossword({
        title: "Monday Mini",
        dow: "Monday",
        date: new Date("2023-12-31T00:00:00.000Z"),
        col_size: 4,
        row_size: 4,
        grid: Array(16).fill("M"),
      });
      await createCrossword({
        title: "Tuesday Standard",
        dow: "Tuesday",
        date: new Date("2024-01-01T00:00:00.000Z"),
        col_size: 5,
        row_size: 5,
        grid: Array(25).fill("T"),
      });
      await createCrossword({
        title: "Wednesday Challenge",
        dow: "Wednesday",
        date: new Date("2024-01-02T00:00:00.000Z"),
        col_size: 6,
        row_size: 6,
        grid: Array(36).fill("W"),
      });

      app = await buildServer();
      const response = await app.inject({
        method: "GET",
        url: "/crosswords?dow=Tuesday&col_size=5&row_size=5",
      });

      expect(response.statusCode).toBe(200);
      const sanitized = sanitizeCrosswordList(response.json());
      console.log("filtered crosswords sanitized:", sanitized);

      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "crosswords.route.test.ts",
        snapshotName: "filters crosswords by query parameters",
        received: sanitized,
      });
    } catch (error) {
      if (error instanceof AggregateError) {
        console.error(
          "filters crosswords AggregateError details:",
          error.errors,
        );
      } else {
        console.error("filters crosswords error:", error);
      }
      throw error;
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it("rejects loading crosswords when unauthenticated", async () => {
    let app: Awaited<ReturnType<typeof buildServer>> | undefined;
    try {
      app = await buildServer();
      const response = await app.inject({
        method: "POST",
        url: "/crosswords/load_crosswords",
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "Unauthorized" });
    } catch (error) {
      if (error instanceof AggregateError) {
        console.error(
          "load crosswords unauthorized AggregateError details:",
          error.errors,
        );
      } else {
        console.error("load crosswords unauthorized error:", error);
      }
      throw error;
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it("rates crossword difficulty", async () => {
    const user = await createUser({
      username: "solver",
      email: "solver@example.com",
    });
    const crossword = await createCrossword({
      title: "Difficulty Rated Crossword",
      dow: "Thursday",
      date: new Date("2024-02-01T00:00:00.000Z"),
    });

    let app: Awaited<ReturnType<typeof buildServer>> | undefined;
    try {
      app = await buildServer({ id: user.id });
      const response = await app.inject({
        method: "POST",
        url: `/crosswords/${crossword.id}/rate-difficulty`,
        payload: { rating: "too_hard" },
      });

      expect(response.statusCode).toBe(200);
      const sanitized = sanitizeRatingResponse(response.json());

      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "crosswords.route.test.ts",
        snapshotName: "rates crossword difficulty",
        received: sanitized,
      });
    } catch (error) {
      if (error instanceof AggregateError) {
        console.error(
          "rate difficulty AggregateError details:",
          error.errors,
        );
      } else {
        console.error("rate difficulty error:", error);
      }
      throw error;
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it("rates crossword quality", async () => {
    const user = await createUser({
      username: "reviewer",
      email: "reviewer@example.com",
    });
    const crossword = await createCrossword({
      title: "Quality Rated Crossword",
      dow: "Friday",
      date: new Date("2024-02-02T00:00:00.000Z"),
    });

    let app: Awaited<ReturnType<typeof buildServer>> | undefined;
    try {
      app = await buildServer({ id: user.id });
      const response = await app.inject({
        method: "POST",
        url: `/crosswords/${crossword.id}/rate-quality`,
        payload: { rating: 4 },
      });

      expect(response.statusCode).toBe(200);
      const sanitized = sanitizeRatingResponse(response.json());

      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "crosswords.route.test.ts",
        snapshotName: "rates crossword quality",
        received: sanitized,
      });
    } catch (error) {
      if (error instanceof AggregateError) {
        console.error(
          "rate quality AggregateError details:",
          error.errors,
        );
      } else {
        console.error("rate quality error:", error);
      }
      throw error;
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it("returns crossword ratings", async () => {
    const crossword = await createCrossword({
      title: "Aggregated Crossword",
      dow: "Saturday",
      date: new Date("2024-02-03T00:00:00.000Z"),
    });

    const userA = await createUser({
      username: "user_a",
      email: "user_a@example.com",
    });
    const userB = await createUser({
      username: "user_b",
      email: "user_b@example.com",
    });
    const userC = await createUser({
      username: "user_c",
      email: "user_c@example.com",
    });

    await createRating({
      user: userA,
      userId: userA.id,
      crossword,
      crosswordId: crossword.id,
      difficultyRating: "too_easy",
      qualityRating: 4,
    });
    await createRating({
      user: userB,
      userId: userB.id,
      crossword,
      crosswordId: crossword.id,
      difficultyRating: "just_right",
      qualityRating: 5,
    });
    await createRating({
      user: userC,
      userId: userC.id,
      crossword,
      crosswordId: crossword.id,
      difficultyRating: "too_hard",
      qualityRating: 3,
    });

    let app: Awaited<ReturnType<typeof buildServer>> | undefined;
    try {
      app = await buildServer();
      const response = await app.inject({
        method: "GET",
        url: `/crosswords/${crossword.id}/ratings`,
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();

      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "crosswords.route.test.ts",
        snapshotName: "returns crossword ratings",
        received: payload,
      });
    } catch (error) {
      if (error instanceof AggregateError) {
        console.error(
          "get crossword ratings AggregateError details:",
          error.errors,
        );
      } else {
        console.error("get crossword ratings error:", error);
      }
      throw error;
    } finally {
      if (app) {
        await app.close();
      }
    }
  });
});
