// Mock queues BEFORE any imports that might use them
jest.mock("../../src/jobs/queues", () => {
  const createQueueMock = () => ({
    add: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    upsertJobScheduler: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  });

  return {
    __esModule: true,
    emailQueue: createQueueMock(),
    statusCleanupQueue: createQueueMock(),
    gameTimeoutQueue: {
      ...createQueueMock(),
      remove: jest.fn().mockResolvedValue(undefined),
    },
    gameInactivityQueue: createQueueMock(),
  };
});

import Fastify from "fastify";
import { DataSource } from "typeorm";
import type { PluginDataSource } from "typeorm-fastify-plugin";
import { ensureApprovedSnapshot } from "../utils/approval";
import { createPostgresTestManager } from "../utils/postgres";
import { createRedisTestManager } from "../utils/redis";
import roomsRoutes from "../../src/routes/private/rooms";
import { JoinMethod, Room } from "../../src/entities/Room";
import { User } from "../../src/entities/User";
import { Crossword } from "../../src/entities/Crossword";
import { GameStats } from "../../src/entities/GameStats";
import { CrosswordRating } from "../../src/entities/CrosswordRating";
import { fastify as singletonFastify } from "../../src/fastify";
import { config } from "../../src/config/config";
import { redisService } from "../../src/services/RedisService";
import {
  emailQueue,
  gameInactivityQueue,
  gameTimeoutQueue,
  statusCleanupQueue,
} from "../../src/jobs/queues";

type ToEmit = { roomId: string; event: string; payload: any };
type InJoin = { channel: string; roomId: string };

const createIoHarness = () => {
  const roomEmits: ToEmit[] = [];
  const channelEmits: { channel: string; event: string; payload: any }[] = [];
  const joins: InJoin[] = [];

  const to = jest.fn((roomId: string) => ({
    emit: (event: string, payload: any) => {
      roomEmits.push({ roomId, event, payload });
    },
  }));

  const inFn = jest.fn((channel: string) => ({
    socketsJoin: (roomId: string) => {
      joins.push({ channel, roomId });
    },
    emit: (event: string, payload: any) => {
      channelEmits.push({ channel, event, payload });
    },
  }));

  const reset = () => {
    roomEmits.splice(0, roomEmits.length);
    channelEmits.splice(0, channelEmits.length);
    joins.splice(0, joins.length);
    to.mockClear();
    inFn.mockClear();
  };

  return {
    to,
    in: inFn,
    except: jest.fn().mockReturnThis(),
    getRoomEmits: () => roomEmits,
    getChannelEmits: () => channelEmits,
    getJoins: () => joins,
    reset,
  };
};

const ioHarness = createIoHarness();

singletonFastify.io = ioHarness as any;
singletonFastify.log = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as any;

const redisManager = createRedisTestManager({
  url: config.redis.default,
  label: "Rooms route tests Redis",
});

const postgres = createPostgresTestManager({
  label: "Rooms route tests",
  entities: [Room, User, Crossword, GameStats, CrosswordRating],
  env: {
    database: [
      "ROOM_ROUTES_TEST_DB",
      "ROOM_SERVICE_TEST_DB",
      "POSTGRES_DB",
    ],
    schema: [
      "ROOM_ROUTES_TEST_SCHEMA",
      "ROOM_SERVICE_TEST_SCHEMA",
    ],
    host: [
      "ROOM_ROUTES_TEST_DB_HOST",
      "ROOM_SERVICE_TEST_DB_HOST",
      "PGHOST",
    ],
    port: [
      "ROOM_ROUTES_TEST_DB_PORT",
      "ROOM_SERVICE_TEST_DB_PORT",
      "PGPORT",
    ],
    username: [
      "ROOM_ROUTES_TEST_DB_USER",
      "ROOM_SERVICE_TEST_DB_USER",
      "PGUSER",
    ],
    password: [
      "ROOM_ROUTES_TEST_DB_PASSWORD",
      "ROOM_SERVICE_TEST_DB_PASSWORD",
      "PGPASSWORD",
    ],
  },
  defaults: {
    database: "crossed_test",
    schema: "rooms_route_test",
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
  "room",
  "crossword",
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

const sanitizeRoomView = (payload: any) => ({
  id: payload.id,
  status: payload.status,
  type: payload.type,
  difficulty: payload.difficulty,
  player_count: payload.player_count,
  created_at: normalizeDate(payload.created_at),
  completed_at: normalizeDate(payload.completed_at),
  players: [...payload.players]
    .map((player: any) => ({
      id: player.id,
      username: player.username,
      score: player.score,
      eloRating: player.eloRating,
    }))
    .sort((a, b) => a.id - b.id),
  scores: payload.scores,
  crossword: {
    id: payload.crossword.id,
    title: payload.crossword.title,
    col_size: payload.crossword.col_size,
    row_size: payload.crossword.row_size,
  },
  found_letters: payload.found_letters,
});

const sanitizeRoomList = (payload: any[]) =>
  payload
    .map((room) => sanitizeRoomView(room))
    .sort((a, b) => a.id - b.id);

const buildServer = async (user: User) => {
  const app = Fastify({ logger: false });
  app.decorate("orm", dataSource as unknown as PluginDataSource);
  app.decorate("io", ioHarness as any);
  app.decorateRequest("user", null);
  app.addHook("preHandler", (request, _reply, done) => {
    request.user = user;
    done();
  });

  roomsRoutes(app as any, {}, () => {});
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

const createCrossword = async (overrides: Partial<Crossword> = {}) => {
  const repository = dataSource.getRepository(Crossword);
  const size = overrides.col_size ?? 4;
  const rowSize = overrides.row_size ?? size;
  const total = size * rowSize;
  const crossword = repository.create({
    title: "Test Crossword",
    author: "Test Author",
    created_by: "Tester",
    creator_link: "https://example.com",
    clues: {
      across: ["1. Across clue", "2. Across clue"],
      down: ["1. Down clue", "2. Down clue"],
    },
    answers: {
      across: ["ABCD"],
      down: ["AD"],
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
    row_size: rowSize,
    jnote: "Test note",
    notepad: "Test notepad",
    date: new Date("2024-01-01"),
    dow: "Monday",
    ...overrides,
  });
  return repository.save(crossword);
};

const createRoom = async ({
  players,
  crossword,
  status = "pending",
  type = "1v1",
  difficulty = "easy",
  foundLetters,
  scores,
}: {
  players: User[];
  crossword: Crossword;
  status?: Room["status"];
  type?: Room["type"];
  difficulty?: string;
  foundLetters?: string[];
  scores?: Record<string, number>;
}) => {
  const repository = dataSource.getRepository(Room);
  const letters = foundLetters ??
    Array(crossword.col_size * crossword.row_size).fill("*");
  const defaultScores = scores ??
    players.reduce(
      (acc, player) => ({
        ...acc,
        [player.id]: 0,
      }),
      {},
    );

  const room = repository.create({
    players,
    crossword,
    status,
    type,
    difficulty,
    scores: defaultScores,
    found_letters: letters,
    join_type: JoinMethod.RANDOM,
  });
  return repository.save(room);
};

beforeAll(async () => {
  await postgres.setup();
  dataSource = postgres.dataSource;
  await redisManager.setup();
  await redisManager.flush();
});

beforeEach(async () => {
  await postgres.truncate(TABLES_TO_TRUNCATE);
  ioHarness.reset();
  await redisManager.flush();
});

afterAll(async () => {
  // Close all resources in the correct order to prevent hanging

  // 1. First, close the singleton fastify instance (if it has any active connections)
  try {
    await singletonFastify.close();
  } catch (error) {
    // Fastify may not be initialized or already closed
  }

  // 2. Close all queue connections (mocked, but still need to be called)
  await Promise.allSettled([
    emailQueue.close(),
    statusCleanupQueue.close(),
    gameTimeoutQueue.close(),
    gameInactivityQueue.close(),
  ]);

  // 3. Close RedisService connections (publisher, subscriber, main client)
  try {
    await redisService.close();
  } catch (error) {
    // May already be closed or not initialized
  }

  // 4. Flush and close the test Redis manager
  try {
    await redisManager.flush();
  } catch (error) {
    // Ignore flush errors during cleanup
  }

  try {
    await redisManager.close();
  } catch (error) {
    // Ignore close errors during cleanup
  }

  // 5. Finally, close the database connection
  try {
    await postgres.close();
  } catch (error) {
    // Ignore close errors during cleanup
  }
});

describe("rooms routes (integration)", () => {
  it("returns a room view by id", async () => {
    const owner = await createUser({ username: "owner" });
    const crossword = await createCrossword({ title: "Room View Puzzle" });
    const room = await createRoom({
      players: [owner],
      crossword,
      status: "pending",
      difficulty: "medium",
    });

    const app = await buildServer(owner);
    try {
      const response = await app.inject({
        method: "GET",
        url: `/rooms/${room.id}`,
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      const sanitized = sanitizeRoomView(payload);

      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "rooms.route.test.ts",
        snapshotName: "returns a room view by id",
        received: sanitized,
      });
    } finally {
      await app.close();
    }
  });

  it("cancels a pending room and emits notifications", async () => {
    const owner = await createUser({ username: "owner" });
    const opponent = await createUser({ username: "opponent" });
    const crossword = await createCrossword({ title: "Cancelable Puzzle" });
    const room = await createRoom({
      players: [owner, opponent],
      crossword,
      status: "pending",
      difficulty: "hard",
    });

    const app = await buildServer(owner);
    try {
      const response = await app.inject({
        method: "POST",
        url: `/rooms/${room.id}/cancel`,
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      const sanitized = sanitizeRoomView(payload);

      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "rooms.route.test.ts",
        snapshotName: "cancels a pending room and emits notifications",
        received: sanitized,
      });
    } finally {
      await app.close();
    }
  });

  it("allows a user to join an existing room and broadcasts updates", async () => {
    const owner = await createUser({ username: "owner" });
    const joiner = await createUser({ username: "joiner" });
    const crossword = await createCrossword({ title: "Join Puzzle" });
    const room = await createRoom({
      players: [owner],
      crossword,
      status: "pending",
      difficulty: "easy",
    });

    const app = await buildServer(joiner);
    try {
      const response = await app.inject({
        method: "POST",
        url: "/rooms/join",
        payload: { difficulty: "easy", type: "1v1" },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      const sanitized = sanitizeRoomView(payload);

      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "rooms.route.test.ts",
        snapshotName:
          "allows a user to join an existing room and broadcasts updates",
        received: sanitized,
      });

      const roomEmits = ioHarness.getRoomEmits();
      expect(roomEmits).toContainEqual({
        roomId: room.id.toString(),
        event: "room",
        payload: expect.any(Object),
      });

      const joins = ioHarness.getJoins();
      expect(joins).toContainEqual({
        channel: `user_${joiner.id}`,
        roomId: room.id.toString(),
      });
    } finally {
      await app.close();
    }
  });

  it("lists rooms for the authenticated user filtered by status", async () => {
    const owner = await createUser({ username: "owner" });
    const opponent = await createUser({ username: "opponent" });
    const crossword = await createCrossword({ title: "Listing Puzzle" });
    await createRoom({
      players: [owner, opponent],
      crossword,
      status: "playing",
      difficulty: "medium",
    });
    await createRoom({
      players: [owner],
      crossword,
      status: "pending",
      difficulty: "easy",
    });

    const app = await buildServer(owner);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/rooms?status=pending",
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      const sanitized = sanitizeRoomList(payload);

      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "rooms.route.test.ts",
        snapshotName:
          "lists rooms for the authenticated user filtered by status",
        received: sanitized,
      });
    } finally {
      await app.close();
    }
  });
});
