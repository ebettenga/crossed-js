import { DataSource } from "typeorm";
import Redis from "ioredis";
import { RoomService } from "../../src/services/RoomService";
import { Room, JoinMethod } from "../../src/entities/Room";
import { User } from "../../src/entities/User";
import { Crossword } from "../../src/entities/Crossword";
import { GameStats } from "../../src/entities/GameStats";
import { fastify } from "../../src/fastify";
import {
  gameTimeoutQueue,
  gameInactivityQueue,
  statusCleanupQueue,
  emailQueue,
} from "../../src/jobs/queues";
import { config } from "../../src/config/config";
import { RedisService, redisService } from "../../src/services/RedisService";
import { ForbiddenError } from "../../src/errors/api";

jest.setTimeout(60000);

const TEST_DB =
  process.env.ROOM_SERVICE_TEST_DB ||
  process.env.POSTGRES_DB ||
  "crossed_test";
const TEST_SCHEMA =
  process.env.ROOM_SERVICE_TEST_SCHEMA || "room_service_test";
const TEST_HOST =
  process.env.ROOM_SERVICE_TEST_DB_HOST || process.env.PGHOST || "127.0.0.1";
const TEST_PORT = parseInt(
  process.env.ROOM_SERVICE_TEST_DB_PORT || process.env.PGPORT || "5432",
  10,
);
const TEST_USER =
  process.env.ROOM_SERVICE_TEST_DB_USER || process.env.PGUSER || "postgres";
const TEST_PASSWORD =
  process.env.ROOM_SERVICE_TEST_DB_PASSWORD ||
  process.env.PGPASSWORD ||
  "postgres";

if (!/_test$/i.test(TEST_DB)) {
  throw new Error(
    `RoomService integration tests require a dedicated test database (got "${TEST_DB}"). Set ROOM_SERVICE_TEST_DB to a database whose name ends with "_test".`,
  );
}

const baseConnectionOptions = {
  type: "postgres" as const,
  host: TEST_HOST,
  port: TEST_PORT,
  username: TEST_USER,
  password: TEST_PASSWORD,
  database: TEST_DB,
};

const qualified = (tableName: string) =>
  `"${TEST_SCHEMA}"."${tableName}"`;

let dataSource: DataSource;
let redisClient: Redis;
const activeRedisServices: RedisService[] = [];

let socketsJoinSpy: jest.Mock;
let inSpy: jest.Mock;
let emitSpy: jest.Mock;
let toSpy: jest.Mock;

let userCounter = 1;

const ensureTestSchema = async () => {
  const adminDataSource = new DataSource({
    ...baseConnectionOptions,
    synchronize: false,
    schema: undefined,
    entities: [],
  });

  await adminDataSource.initialize();
  await adminDataSource.query(
    `CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`,
  );
  await adminDataSource.destroy();
};

const initialiseDataSource = async () => {
  dataSource = new DataSource({
    ...baseConnectionOptions,
    schema: TEST_SCHEMA,
    synchronize: true,
    entities: [Room, User, Crossword, GameStats],
  });

  await dataSource.initialize();
};

const flushQueues = async () => {
  await gameTimeoutQueue.waitUntilReady();
  await gameInactivityQueue.waitUntilReady();

  await Promise.all(
    [gameTimeoutQueue, gameInactivityQueue].map(async (queue) => {
      try {
        await queue.obliterate({ force: true });
      } catch (error: any) {
        if (
          error?.message &&
          (error.message.includes("Missing key") ||
            error.message.includes("JobObliterateError"))
        ) {
          return;
        }
        throw error;
      }
    }),
  );
};

const flushRedis = async () => {
  await redisClient.flushdb();
};

const clearDatabase = async () => {
  await dataSource.query(
    `TRUNCATE TABLE ${qualified("game_stats")}, ${qualified("room_players")}, ${qualified("room")}, ${qualified("user")}, ${qualified("crossword")} RESTART IDENTITY CASCADE`,
  );
};

const createUser = async (overrides: Partial<User> = {}) => {
  const repository = dataSource.getRepository(User);
  const user = repository.create({
    username: `player_${userCounter}`,
    email: `player_${userCounter}@test.com`,
    password: "test-password",
    roles: ["user"],
    status: "online",
    eloRating: 1200,
    ...overrides,
  });
  userCounter += 1;
  return repository.save(user);
};

const createCrossword = async (overrides: Partial<Crossword> = {}) => {
  const repository = dataSource.getRepository(Crossword);
  const crossword = repository.create({
    clues: { across: [], down: [] },
    answers: { across: [], down: [] },
    author: "Integration Author",
    circles: [],
    date: new Date(),
    dow: "Monday",
    grid: Array(16).fill("A"),
    gridnums: [],
    shadecircles: false,
    col_size: 4,
    row_size: 4,
    jnote: "Integration note",
    notepad: "Integration notepad",
    title: `Integration Crossword ${Date.now()}`,
    ...overrides,
  });
  return repository.save(crossword);
};

const createRoomService = () => {
  const service = new RoomService(dataSource);
  const redis = (service as any).redisService as RedisService | undefined;
  if (redis) {
    activeRedisServices.push(redis);
  }
  return service;
};

beforeAll(async () => {
  try {
    await ensureTestSchema();
    await initialiseDataSource();
    redisClient = new Redis(config.redis.default);
    await flushRedis();
    await flushQueues();
  } catch (error) {
    console.error(
      "Failed to initialise RoomService integration test environment. Ensure Postgres and Redis are reachable with the credentials provided.",
    );
    throw error;
  }
});

beforeEach(async () => {
  socketsJoinSpy = jest.fn();
  inSpy = jest.fn(() => ({ socketsJoin: socketsJoinSpy }));
  emitSpy = jest.fn();
  toSpy = jest.fn(() => ({ emit: emitSpy }));
  (fastify as any).io = { in: inSpy, to: toSpy };

  await clearDatabase();
  await flushRedis();
  await flushQueues();
});

afterEach(async () => {
  delete (fastify as any).io;

  while (activeRedisServices.length > 0) {
    const redis = activeRedisServices.pop();
    if (redis) {
      await redis.close();
    }
  }
});

afterAll(async () => {
  if (redisClient) {
    await redisClient.flushdb();
    await redisClient.quit();
  }

  await Promise.allSettled([
    gameTimeoutQueue.close(),
    gameInactivityQueue.close(),
    statusCleanupQueue.close(),
    emailQueue.close(),
  ]);

  if (dataSource?.isInitialized) {
    await dataSource.destroy();
  }
  await redisService.close();
});

describe("RoomService integration", () => {
  it("creates a new room, persists stats, and enqueues timeout jobs", async () => {
    const host = await createUser();
    const hostRecord = await dataSource
      .getRepository(User)
      .findOneByOrFail({ id: host.id });
    await createCrossword({ dow: "Monday" });
    const service = createRoomService();

    const room = await service.joinRoom(hostRecord, "easy", "1v1");

    expect(room.id).toBeGreaterThan(0);
    expect(room.join).toBe(JoinMethod.RANDOM);
    expect(room.players.map((player) => player.id)).toEqual([host.id]);

    const roomRepository = dataSource.getRepository(Room);
    const persisted = await roomRepository.findOneBy({ id: room.id });
    expect(persisted).not.toBeNull();
    expect(persisted?.players).toHaveLength(1);
    expect(persisted?.players[0].id).toBe(host.id);

    const statsRepository = dataSource.getRepository(GameStats);
    const stats = await statsRepository.findOneBy({
      roomId: room.id,
      userId: host.id,
    });
    expect(stats).not.toBeNull();

    expect(inSpy).toHaveBeenCalledWith(`user_${host.id}`);
    expect(socketsJoinSpy).toHaveBeenCalledWith(room.id.toString());

    const timeoutJob = await gameTimeoutQueue.getJob("game-timeout");
    expect(timeoutJob).not.toBeNull();
    expect(timeoutJob?.data).toEqual({ roomId: room.id });
  });

  it("adds a player to an existing room, starts the game, and syncs redis cache", async () => {
    const existingPlayer = await createUser();
    const joiningPlayer = await createUser();
    const existingRecord = await dataSource
      .getRepository(User)
      .findOneByOrFail({ id: existingPlayer.id });
    const joiningRecord = await dataSource
      .getRepository(User)
      .findOneByOrFail({ id: joiningPlayer.id });
    const crossword = await createCrossword({ dow: "Monday" });
    const service = createRoomService();

    const pendingRoom = await service.joinRoom(
      existingRecord,
      "easy",
      "1v1",
    );
    const cachedGameInfo = {
      lastActivityAt: Date.now(),
      foundLetters: Array(crossword.grid.length).fill("*"),
      scores: { [existingPlayer.id]: 5 },
      userGuessCounts: {
        [existingPlayer.id]: { correct: 1, incorrect: 0 },
      },
      correctGuessDetails: {
        [existingPlayer.id]: [],
      },
    };

    await redisClient.set(
      pendingRoom.id.toString(),
      JSON.stringify(cachedGameInfo),
    );

    const roomRepository = dataSource.getRepository(Room);
    const hydratedRoom = await roomRepository.findOneBy({
      id: pendingRoom.id,
    });
    expect(hydratedRoom).not.toBeNull();

    await service.joinExistingRoom(hydratedRoom!, joiningRecord.id);

    const updatedRoom = await roomRepository.findOneBy({ id: pendingRoom.id });
    expect(updatedRoom?.status).toBe("playing");
    expect(updatedRoom?.players.map((p) => p.id).sort()).toEqual(
      [existingRecord.id, joiningRecord.id].sort(),
    );

    expect(inSpy).toHaveBeenCalledWith(`user_${joiningRecord.id}`);
    expect(toSpy).toHaveBeenCalledWith(pendingRoom.id.toString());
    expect(emitSpy).toHaveBeenCalledWith(
      "game_started",
      expect.objectContaining({
        room: expect.any(Object),
      }),
    );

    const cached = await redisClient.get(pendingRoom.id.toString());
    expect(cached).not.toBeNull();
    const parsed = JSON.parse(cached!);
    expect(parsed.userGuessCounts[joiningRecord.id]).toEqual({
      correct: 0,
      incorrect: 0,
    });
    expect(parsed.correctGuessDetails[joiningRecord.id]).toEqual([]);

    const inactivityJobs = await gameInactivityQueue.getDelayed();
    const hasJob = inactivityJobs.some(
      (job) => job.data.roomId === pendingRoom.id,
    );
    expect(hasJob).toBe(true);
  });

  it("rejects cancellation attempts by non-participants", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const ownerRecord = await dataSource
      .getRepository(User)
      .findOneByOrFail({ id: owner.id });
    const outsiderRecord = await dataSource
      .getRepository(User)
      .findOneByOrFail({ id: outsider.id });
    await createCrossword({ dow: "Monday" });
    const service = createRoomService();

    const room = await service.joinRoom(ownerRecord, "easy", "1v1");

    await expect(
      service.cancelRoom(room.id, outsiderRecord.id),
    ).rejects.toThrow(
      ForbiddenError,
    );

    const persisted = await dataSource
      .getRepository(Room)
      .findOneBy({ id: room.id });
    expect(persisted?.status).toBe("pending");
  });

  it("allows a participant to cancel a pending room", async () => {
    const owner = await createUser();
    const ownerRecord = await dataSource
      .getRepository(User)
      .findOneByOrFail({ id: owner.id });
    await createCrossword({ dow: "Monday" });
    const service = createRoomService();

    const room = await service.joinRoom(ownerRecord, "easy", "1v1");
    const cancelled = await service.cancelRoom(room.id, ownerRecord.id);

    expect(cancelled.status).toBe("cancelled");

    const persisted = await dataSource
      .getRepository(Room)
      .findOneBy({ id: room.id });
    expect(persisted?.status).toBe("cancelled");
  });
});
