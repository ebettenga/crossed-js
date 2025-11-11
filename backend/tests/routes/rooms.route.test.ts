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
    gameAutoRevealQueue: createQueueMock(),
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
import { UserCrosswordPack } from "../../src/entities/UserCrosswordPack";
import { TimeTrialLeaderboardEntry } from "../../src/entities/TimeTrialLeaderboardEntry";
import { fastify as singletonFastify } from "../../src/fastify";
import { config } from "../../src/config/config";
import { redisService } from "../../src/services/RedisService";
import {
  emailQueue,
  gameAutoRevealQueue,
  gameTimeoutQueue,
  statusCleanupQueue,
} from "../../src/jobs/queues";
import responseCachePlugin from "../../src/plugins/response-cache";

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
  entities: [
    Room,
    User,
    Crossword,
    GameStats,
    CrosswordRating,
    UserCrosswordPack,
    TimeTrialLeaderboardEntry,
  ],
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
  "user_crossword_pack",
  "time_trial_leaderboard_entry",
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

const sanitizeLeaderboard = (payload: any) => ({
  topEntries: payload.topEntries.map((entry: any) => ({
    rank: entry.rank,
    roomId: entry.roomId,
    score: entry.score,
    user: entry.user
      ? {
        id: entry.user.id,
        username: entry.user.username,
        eloRating: entry.user.eloRating,
      }
      : null,
    created_at: entry.created_at ? "[timestamp]" : null,
    completed_at: entry.completed_at ? "[timestamp]" : null,
    timeTakenMs: entry.timeTakenMs ?? null,
  })),
  currentPlayerEntry: payload.currentPlayerEntry
    ? {
      rank: payload.currentPlayerEntry.rank,
      roomId: payload.currentPlayerEntry.roomId,
      score: payload.currentPlayerEntry.score,
      user: payload.currentPlayerEntry.user
        ? {
          id: payload.currentPlayerEntry.user.id,
          username: payload.currentPlayerEntry.user.username,
          eloRating: payload.currentPlayerEntry.user.eloRating,
        }
        : null,
      created_at: payload.currentPlayerEntry.created_at ? "[timestamp]" : null,
      completed_at: payload.currentPlayerEntry.completed_at
        ? "[timestamp]"
        : null,
      timeTakenMs: payload.currentPlayerEntry.timeTakenMs ?? null,
    }
    : undefined,
});

const sanitizeRoomStats = (payload: any[]) =>
  [...payload]
    .map((stat) => ({
      userId: stat.userId,
      correctGuesses: stat.correctGuesses,
      incorrectGuesses: stat.incorrectGuesses,
      isWinner: stat.isWinner,
      eloAtGame: stat.eloAtGame,
      eloChange: stat.eloChange ?? null,
      correctGuessDetails: stat.correctGuessDetails ?? [],
    }))
    .sort((a, b) => a.userId - b.userId);

const sanitizeRecentGames = (payload: any[]) =>
  payload.map((entry) => ({
    room: {
      id: entry.room.id,
      status: entry.room.status,
      type: entry.room.type,
      difficulty: entry.room.difficulty,
      created_at: normalizeDate(entry.room.created_at),
      completed_at: normalizeDate(entry.room.completed_at),
      scores: entry.room.scores,
    },
    stats: entry.stats,
  }));

const buildServer = async (user: User) => {
  const app = Fastify({ logger: false });
  app.decorate("orm", dataSource as unknown as PluginDataSource);
  app.decorate("io", ioHarness as any);
  app.decorateRequest("user", null);
  app.addHook("preHandler", (request, _reply, done) => {
    request.user = user;
    done();
  });

  await app.register(responseCachePlugin);

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
    date: new Date("2024-01-01T00:00:00.000Z"),
    dow: "Monday",
    pack: "general",
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
    gameAutoRevealQueue.close(),
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

  it("returns filtered recent games with stats for the authenticated user", async () => {
    const viewer = await createUser({ username: "recent_viewer" });
    const crossword = await createCrossword({ title: "Recent Stats Puzzle" });
    const roomRepository = dataSource.getRepository(Room);
    const statsRepository = dataSource.getRepository(GameStats);

    const olderRoom = await createRoom({
      players: [viewer],
      crossword,
      status: "finished",
      difficulty: "medium",
    });
    olderRoom.completed_at = new Date("2024-01-01T10:00:00.000Z");
    await roomRepository.save(olderRoom);
    let olderStats = statsRepository.create({
      room: olderRoom,
      user: viewer,
      roomId: olderRoom.id,
      userId: viewer.id,
      correctGuesses: 5,
      incorrectGuesses: 1,
      isWinner: true,
      eloAtGame: viewer.eloRating,
      correctGuessDetails: [],
    });
    olderStats = await statsRepository.save(olderStats);
    olderStats.createdAt = new Date("2024-01-01T10:05:00.000Z");
    await statsRepository.save(olderStats);

    const recentRoom = await createRoom({
      players: [viewer],
      crossword,
      status: "finished",
      difficulty: "hard",
      scores: { [viewer.id]: 42 },
    });
    recentRoom.completed_at = new Date("2024-02-01T10:00:00.000Z");
    await roomRepository.save(recentRoom);
    let recentStats = statsRepository.create({
      room: recentRoom,
      user: viewer,
      roomId: recentRoom.id,
      userId: viewer.id,
      correctGuesses: 12,
      incorrectGuesses: 3,
      isWinner: false,
      eloAtGame: viewer.eloRating,
      correctGuessDetails: [],
    });
    recentStats = await statsRepository.save(recentStats);
    recentStats.createdAt = new Date("2024-02-01T10:05:00.000Z");
    await statsRepository.save(recentStats);

    const app = await buildServer(viewer);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/rooms/recent?limit=5&startTime=2024-01-15T00:00:00.000Z",
      });

      expect(response.statusCode).toBe(200);
      const sanitized = sanitizeRecentGames(response.json());

      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "rooms.route.test.ts",
        snapshotName:
          "returns filtered recent games with stats for the authenticated user",
        received: sanitized,
      });
    } finally {
      await app.close();
    }
  });

  it("validates date ranges when requesting recent games", async () => {
    const viewer = await createUser({ username: "recent_validator" });
    const app = await buildServer(viewer);
    try {
      const response = await app.inject({
        method: "GET",
        url:
          "/rooms/recent?startTime=2024-03-01T00:00:00.000Z&endTime=2024-02-01T00:00:00.000Z",
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: "startTime must be before endTime",
      });
    } finally {
      await app.close();
    }
  });

  it("lists pending challenge rooms for the authenticated user", async () => {
    const viewer = await createUser({ username: "challengee" });
    const challenger = await createUser({ username: "challenger" });
    const outsider = await createUser({ username: "outsider" });
    const crossword = await createCrossword({ title: "Challenge Puzzle" });
    const roomRepository = dataSource.getRepository(Room);

    const challengeRoom = await createRoom({
      players: [viewer, challenger],
      crossword,
      status: "pending",
      type: "1v1",
      difficulty: "hard",
    });
    challengeRoom.join = JoinMethod.CHALLENGE;
    challengeRoom.markModified();
    await roomRepository.save(challengeRoom);

    await createRoom({
      players: [outsider],
      crossword,
      status: "pending",
      type: "1v1",
      difficulty: "easy",
    });

    await createRoom({
      players: [viewer],
      crossword,
      status: "playing",
      type: "1v1",
      difficulty: "medium",
    });

    const app = await buildServer(viewer);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/rooms/challenges/pending",
      });

      expect(response.statusCode).toBe(200);
      const sanitized = sanitizeRoomList(response.json());

      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "rooms.route.test.ts",
        snapshotName:
          "lists pending challenge rooms for the authenticated user",
        received: sanitized,
      });
    } finally {
      await app.close();
    }
  });

  it("creates a challenge room and notifies participants", async () => {
    const challenger = await createUser({ username: "challenger_creator" });
    const challenged = await createUser({ username: "challenged_creator" });
    await createCrossword({
      title: "Challenge Creation Puzzle",
      dow: "Wednesday",
    });

    const app = await buildServer(challenger);
    try {
      const response = await app.inject({
        method: "POST",
        url: "/rooms/challenge",
        payload: {
          challengedId: challenged.id,
          difficulty: "medium",
          context: "friendly_duel",
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      const sanitized = sanitizeRoomView(payload);

      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "rooms.route.test.ts",
        snapshotName: "creates a challenge room and notifies participants",
        received: sanitized,
      });

      const roomId = payload.id.toString();
      const roomEmits = ioHarness.getRoomEmits();
      expect(roomEmits).toEqual(
        expect.arrayContaining([
          {
            roomId,
            event: "room",
            payload: expect.any(Object),
          },
          {
            roomId: `user_${challenged.id}`,
            event: "challenge_received",
            payload: expect.objectContaining({
              challenger: expect.objectContaining({ id: challenger.id }),
              room: expect.any(Object),
            }),
          },
        ]),
      );

      const joins = ioHarness.getJoins();
      expect(joins).toEqual(
        expect.arrayContaining([
          { channel: `user_${challenger.id}`, roomId },
          { channel: `user_${challenged.id}`, roomId },
        ]),
      );
    } finally {
      await app.close();
    }
  });

  it("accepts a challenge and starts the game", async () => {
    const challenger = await createUser({ username: "challenger_accept" });
    const challenged = await createUser({ username: "challenged_accept" });
    await createCrossword({
      title: "Challenge Accept Puzzle",
      dow: "Friday",
    });

    const creationApp = await buildServer(challenger);
    let roomId: number;
    try {
      const creationResponse = await creationApp.inject({
        method: "POST",
        url: "/rooms/challenge",
        payload: {
          challengedId: challenged.id,
          difficulty: "hard",
          context: "acceptance_test",
        },
      });
      expect(creationResponse.statusCode).toBe(200);
      roomId = creationResponse.json().id;
    } finally {
      await creationApp.close();
    }

    ioHarness.reset();

    const app = await buildServer(challenged);
    try {
      const response = await app.inject({
        method: "POST",
        url: `/rooms/challenge/${roomId}/accept`,
      });

      expect(response.statusCode).toBe(200);
      const sanitized = sanitizeRoomView(response.json());
      sanitized.created_at = "[timestamp]";
      sanitized.completed_at = sanitized.completed_at ? "[timestamp]" : null;

      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "rooms.route.test.ts",
        snapshotName: "accepts a challenge and starts the game",
        received: sanitized,
      });

      const roomEmits = ioHarness.getRoomEmits();
      expect(roomEmits).toEqual(
        expect.arrayContaining([
          {
            roomId: roomId.toString(),
            event: "room",
            payload: expect.any(Object),
          },
          {
            roomId: roomId.toString(),
            event: "game_started",
            payload: expect.objectContaining({
              message: "Challenge accepted! Game is starting.",
            }),
          },
        ]),
      );
    } finally {
      await app.close();
    }
  });

  it("rejects a challenge and marks it as cancelled", async () => {
    const challenger = await createUser({ username: "challenger_reject" });
    const challenged = await createUser({ username: "challenged_reject" });
    await createCrossword({
      title: "Challenge Reject Puzzle",
      dow: "Monday",
    });

    const creationApp = await buildServer(challenger);
    let roomId: number;
    try {
      const creationResponse = await creationApp.inject({
        method: "POST",
        url: "/rooms/challenge",
        payload: {
          challengedId: challenged.id,
          difficulty: "easy",
          context: "reject_test",
        },
      });
      expect(creationResponse.statusCode).toBe(200);
      roomId = creationResponse.json().id;
    } finally {
      await creationApp.close();
    }

    ioHarness.reset();

    const app = await buildServer(challenged);
    try {
      const response = await app.inject({
        method: "POST",
        url: `/rooms/challenge/${roomId}/reject`,
      });

      expect(response.statusCode).toBe(200);
      const sanitized = sanitizeRoomView(response.json());
      sanitized.created_at = "[timestamp]";
      sanitized.completed_at = sanitized.completed_at ? "[timestamp]" : null;

      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "rooms.route.test.ts",
        snapshotName: "rejects a challenge and marks it as cancelled",
        received: sanitized,
      });

      const roomEmits = ioHarness.getRoomEmits();
      expect(roomEmits).toEqual(
        expect.arrayContaining([
          {
            roomId: roomId.toString(),
            event: "room",
            payload: expect.any(Object),
          },
        ]),
      );
    } finally {
      await app.close();
    }
  });

  it("handles a correct guess and broadcasts the updated room view", async () => {
    const player = await createUser({ username: "guesser" });
    const crossword = await createCrossword({
      title: "Guess Puzzle",
      dow: "Monday",
      grid: [
        "A", "B", "C", "D",
        "E", "F", "G", "H",
        "I", "J", "K", "L",
        "M", "N", "O", "P",
      ],
    });
    const foundLetters = Array(
      crossword.col_size * crossword.row_size,
    ).fill("*");
    const room = await createRoom({
      players: [player],
      crossword,
      status: "playing",
      difficulty: "easy",
      foundLetters,
      scores: { [player.id]: 0 },
    });

    const app = await buildServer(player);
    try {
      const response = await app.inject({
        method: "POST",
        url: `/rooms/${room.id}`,
        payload: {
          coordinates: { x: 0, y: 0 },
          guess: "A",
        },
      });

      expect(response.statusCode).toBe(200);
      const sanitized = sanitizeRoomView(response.json());
      sanitized.created_at = "[timestamp]";
      sanitized.completed_at = sanitized.completed_at ? "[timestamp]" : null;

      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "rooms.route.test.ts",
        snapshotName:
          "handles a correct guess and broadcasts the updated room view",
        received: sanitized,
      });

      const roomEmits = ioHarness.getRoomEmits();
      expect(roomEmits).toContainEqual({
        roomId: room.id.toString(),
        event: "room",
        payload: expect.any(Object),
      });
    } finally {
      await app.close();
    }
  });

  it("returns a time-trial leaderboard and includes the current player's entry", async () => {
    const runner = await createUser({ username: "runner" });
    const rival = await createUser({ username: "rival" });
    const champion = await createUser({ username: "champion" });
    const crossword = await createCrossword({ title: "Leaderboard Puzzle" });
    const roomRepository = dataSource.getRepository(Room);

    const championRoom = await createRoom({
      players: [champion],
      crossword,
      status: "finished",
      type: "time_trial",
      difficulty: "expert",
      scores: { [champion.id]: 95 },
    });
    championRoom.created_at = new Date("2024-01-01T10:00:00.000Z");
    championRoom.completed_at = new Date("2024-01-01T10:04:30.000Z");
    await roomRepository.save(championRoom);

    const rivalRoom = await createRoom({
      players: [rival],
      crossword,
      status: "finished",
      type: "time_trial",
      difficulty: "expert",
      scores: { [rival.id]: 80 },
    });
    rivalRoom.created_at = new Date("2024-01-02T10:00:00.000Z");
    rivalRoom.completed_at = new Date("2024-01-02T10:06:00.000Z");
    await roomRepository.save(rivalRoom);

    const runnerRoom = await createRoom({
      players: [runner],
      crossword,
      status: "finished",
      type: "time_trial",
      difficulty: "expert",
      scores: { [runner.id]: 70 },
    });
    runnerRoom.created_at = new Date("2024-01-03T10:00:00.000Z");
    runnerRoom.completed_at = new Date("2024-01-03T10:08:00.000Z");
    await roomRepository.save(runnerRoom);

    const app = await buildServer(runner);
    try {
      const response = await app.inject({
        method: "GET",
        url: `/rooms/${runnerRoom.id}/leaderboard/time-trial?limit=1`,
      });

      expect(response.statusCode).toBe(200);
      const sanitized = sanitizeLeaderboard(response.json());

      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "rooms.route.test.ts",
        snapshotName:
          "returns a time-trial leaderboard and includes the current player's entry",
        received: sanitized,
      });
    } finally {
      await app.close();
    }
  });

  it("returns 404 when leaderboard room is missing", async () => {
    const viewer = await createUser({ username: "leaderboard_missing" });
    const app = await buildServer(viewer);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/rooms/99999/leaderboard/time-trial",
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "Room not found" });
    } finally {
      await app.close();
    }
  });

  it("rejects leaderboard requests for non time-trial rooms", async () => {
    const viewer = await createUser({ username: "leaderboard_invalid" });
    const crossword = await createCrossword();
    const room = await createRoom({
      players: [viewer],
      crossword,
      status: "finished",
      type: "1v1",
    });

    const app = await buildServer(viewer);
    try {
      const response = await app.inject({
        method: "GET",
        url: `/rooms/${room.id}/leaderboard/time-trial`,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: "Leaderboard is only available for time_trial games",
      });
    } finally {
      await app.close();
    }
  });

  it("returns stats for a finished room", async () => {
    const winner = await createUser({ username: "winner" });
    const challenger = await createUser({ username: "stats_challenger" });
    const crossword = await createCrossword({ title: "Stats Puzzle" });
    const roomRepository = dataSource.getRepository(Room);
    const statsRepository = dataSource.getRepository(GameStats);

    const room = await createRoom({
      players: [winner, challenger],
      crossword,
      status: "finished",
      type: "1v1",
      scores: {
        [winner.id]: 55,
        [challenger.id]: 35,
      },
    });
    room.completed_at = new Date("2024-02-15T12:00:00.000Z");
    await roomRepository.save(room);

    await statsRepository.save([
      statsRepository.create({
        room,
        user: winner,
        roomId: room.id,
        userId: winner.id,
        correctGuesses: 20,
        incorrectGuesses: 3,
        isWinner: true,
        eloAtGame: 1180,
        correctGuessDetails: [],
      }),
      statsRepository.create({
        room,
        user: challenger,
        roomId: room.id,
        userId: challenger.id,
        correctGuesses: 10,
        incorrectGuesses: 6,
        isWinner: false,
        eloAtGame: 1190,
        correctGuessDetails: [],
      }),
    ]);

    const app = await buildServer(winner);
    try {
      const response = await app.inject({
        method: "GET",
        url: `/rooms/${room.id}/stats`,
      });

      expect(response.statusCode).toBe(200);
      const sanitized = sanitizeRoomStats(response.json());

      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "rooms.route.test.ts",
        snapshotName: "returns stats for a finished room",
        received: sanitized,
      });
    } finally {
      await app.close();
    }
  });

  it("returns 404 when requesting stats for a missing room", async () => {
    const viewer = await createUser({ username: "stats_missing" });
    const app = await buildServer(viewer);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/rooms/99999/stats",
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "Room not found" });
    } finally {
      await app.close();
    }
  });

  it("rejects stats requests when the room is not finished", async () => {
    const viewer = await createUser({ username: "stats_pending" });
    const crossword = await createCrossword();
    const room = await createRoom({
      players: [viewer],
      crossword,
      status: "playing",
      type: "1v1",
    });

    const app = await buildServer(viewer);
    try {
      const response = await app.inject({
        method: "GET",
        url: `/rooms/${room.id}/stats`,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: "Game stats are only available for finished games",
      });
    } finally {
      await app.close();
    }
  });
});
