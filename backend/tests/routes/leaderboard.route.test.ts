import Fastify from "fastify";
import { DataSource } from "typeorm";
import type { PluginDataSource } from "typeorm-fastify-plugin";
import leaderboardRoutes from "../../src/routes/private/leaderboard";
import { User } from "../../src/entities/User";
import { JoinMethod, Room } from "../../src/entities/Room";
import { Crossword } from "../../src/entities/Crossword";
import { GameStats } from "../../src/entities/GameStats";
import { UserCrosswordPack } from "../../src/entities/UserCrosswordPack";
import { createPostgresTestManager } from "../utils/postgres";
import { createRedisTestManager } from "../utils/redis";
import responseCachePlugin from "../../src/plugins/response-cache";
import { config } from "../../src/config/config";
import { redisService } from "../../src/services/RedisService";

jest.setTimeout(60000);

const postgres = createPostgresTestManager({
  label: "Leaderboard route tests",
  entities: [User, Room, Crossword, GameStats, UserCrosswordPack],
  env: {
    database: [
      "LEADERBOARD_ROUTES_TEST_DB",
      "ROOM_SERVICE_TEST_DB",
      "POSTGRES_DB",
    ],
    schema: [
      "LEADERBOARD_ROUTES_TEST_SCHEMA",
      "ROOM_SERVICE_TEST_SCHEMA",
    ],
    host: [
      "LEADERBOARD_ROUTES_TEST_DB_HOST",
      "ROOM_SERVICE_TEST_DB_HOST",
      "PGHOST",
    ],
    port: [
      "LEADERBOARD_ROUTES_TEST_DB_PORT",
      "ROOM_SERVICE_TEST_DB_PORT",
      "PGPORT",
    ],
    username: [
      "LEADERBOARD_ROUTES_TEST_DB_USER",
      "ROOM_SERVICE_TEST_DB_USER",
      "PGUSER",
    ],
    password: [
      "LEADERBOARD_ROUTES_TEST_DB_PASSWORD",
      "ROOM_SERVICE_TEST_DB_PASSWORD",
      "PGPASSWORD",
    ],
  },
  defaults: {
    database: "crossed_test",
    schema: "leaderboard_route_test",
    host: "127.0.0.1",
    port: 5432,
    username: "postgres",
    password: "postgres",
  },
});

const redisManager = createRedisTestManager({
  url: config.redis.default,
  label: "Leaderboard route tests Redis",
});

const TABLES_TO_TRUNCATE = [
  "room_players",
  "game_stats",
  "room",
  "crossword",
  "user",
];

let dataSource: DataSource;

const buildServer = async () => {
  const app = Fastify({ logger: false });
  app.decorate("orm", dataSource as unknown as PluginDataSource);
  await app.register(responseCachePlugin);
  leaderboardRoutes(app as any, {}, () => {});
  await app.ready();
  return app;
};

const createUser = async (overrides: Partial<User> = {}) => {
  const repository = dataSource.getRepository(User);
  const user = repository.create({
    username: overrides.username ??
      `user_${Math.random().toString(36).slice(2, 8)}`,
    email: overrides.email ?? `${Date.now()}-${Math.random()}@example.com`,
    password: "secret",
    roles: overrides.roles ?? ["user"],
    status: overrides.status ?? "online",
    eloRating: overrides.eloRating ?? 1200,
    ...overrides,
  });
  return repository.save(user);
};

const createCrossword = async () => {
  const repository = dataSource.getRepository(Crossword);
  const size = 4;
  const total = size * size;
  const crossword = repository.create({
    title: "Test Crossword",
    author: "Test Author",
    created_by: "Tester",
    creator_link: "https://example.com",
    clues: {
      across: ["Across clue"],
      down: ["Down clue"],
    },
    answers: {
      across: ["TEST"],
      down: ["TD"],
    },
    circles: Array(total).fill(0),
    grid: Array(total)
      .fill(0)
      .map((_, index) => String.fromCharCode(65 + (index % 26))),
    gridnums: Array(total)
      .fill(0)
      .map((_, index) => String(index + 1)),
    shadecircles: false,
    col_size: size,
    row_size: size,
  });
  return repository.save(crossword);
};

const createTimeTrialRoom = async ({
  player,
  score,
}: {
  player: User;
  score: number;
}) => {
  const roomRepository = dataSource.getRepository(Room);
  const crossword = await createCrossword();
  const now = Date.now();
  const room = roomRepository.create({
    players: [player],
    crossword,
    status: "finished",
    type: "time_trial",
    difficulty: "easy",
    scores: { [player.id]: score },
    found_letters: [],
    join_type: JoinMethod.RANDOM,
    created_at: new Date(now - 60000),
    completed_at: new Date(now - 30000),
    last_activity_at: new Date(now - 30000),
  });
  return roomRepository.save(room);
};

beforeAll(async () => {
  await postgres.setup();
  dataSource = postgres.dataSource;
  await redisManager.setup();
  await redisManager.flush();
});

beforeEach(async () => {
  await postgres.truncate(TABLES_TO_TRUNCATE);
  await redisManager.flush();
});

afterAll(async () => {
  try {
    await redisManager.flush();
  } catch {
    // ignore flush errors during teardown
  }
  try {
    await redisManager.close();
  } catch {
    // ignore close errors during teardown
  }
  try {
    await redisService.close();
  } catch {
    // ignore close errors during teardown
  }
  await postgres.close();
});

describe("leaderboard routes", () => {
  it("returns cached results on subsequent requests", async () => {
    const topUser = await createUser({ username: "alpha", eloRating: 1800 });
    const runnerUp = await createUser({ username: "beta", eloRating: 1700 });
    await createTimeTrialRoom({ player: topUser, score: 42 });

    const app = await buildServer();
    const userRepository = dataSource.getRepository(User);

    try {
      const firstResponse = await app.inject({
        method: "GET",
        url: "/leaderboard?limit=5",
      });

      expect(firstResponse.statusCode).toBe(200);
      expect(firstResponse.headers["x-cache-hit"]).toBe("0");
      const firstPayload = firstResponse.json();
      expect(firstPayload.topElo[0].user.username).toBe("alpha");

      runnerUp.eloRating = 9999;
      await userRepository.save(runnerUp);

      const secondResponse = await app.inject({
        method: "GET",
        url: "/leaderboard?limit=5",
      });

      expect(secondResponse.statusCode).toBe(200);
      expect(secondResponse.headers["x-cache-hit"]).toBe("1");
      expect(secondResponse.json()).toEqual(firstPayload);
    } finally {
      await app.close();
    }
  });
});
