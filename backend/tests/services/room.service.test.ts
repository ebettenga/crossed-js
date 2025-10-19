import { DataSource } from "typeorm";
import Redis from "ioredis";
import { RoomService } from "../../src/services/RoomService";
import { JoinMethod, Room } from "../../src/entities/Room";
import { User } from "../../src/entities/User";
import { Crossword } from "../../src/entities/Crossword";
import { GameStats } from "../../src/entities/GameStats";
import { fastify } from "../../src/fastify";
import {
  emailQueue,
  gameInactivityQueue,
  gameTimeoutQueue,
  statusCleanupQueue,
} from "../../src/jobs/queues";
import { config } from "../../src/config/config";
import { RedisService, redisService } from "../../src/services/RedisService";
import { ForbiddenError } from "../../src/errors/api";
import { createPostgresTestManager } from "../utils/postgres";
import { createRedisTestManager, RedisTestManager } from "../utils/redis";

jest.setTimeout(60000);

const postgres = createPostgresTestManager({
  label: "RoomService tests",
  entities: [Room, User, Crossword, GameStats],
  env: {
    database: ["ROOM_SERVICE_TEST_DB", "POSTGRES_DB"],
    schema: ["ROOM_SERVICE_TEST_SCHEMA"],
    host: ["ROOM_SERVICE_TEST_DB_HOST", "PGHOST"],
    port: ["ROOM_SERVICE_TEST_DB_PORT", "PGPORT"],
    username: ["ROOM_SERVICE_TEST_DB_USER", "PGUSER"],
    password: ["ROOM_SERVICE_TEST_DB_PASSWORD", "PGPASSWORD"],
  },
  defaults: {
    database: "crossed_test",
    schema: "room_service_test",
    host: "127.0.0.1",
    port: 5432,
    username: "postgres",
    password: "postgres",
  },
});

const redisManager = createRedisTestManager({
  url: config.redis.default,
  label: "RoomService tests Redis",
});

let dataSource: DataSource;
let redisClient: Redis;
const activeRedisServices: RedisService[] = [];

let socketsJoinSpy: jest.Mock;
let inSpy: jest.Mock;
let emitSpy: jest.Mock;
let toSpy: jest.Mock;

let userCounter = 1;

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

const clearDatabase = async () => {
  await postgres.truncate([
    "game_stats",
    "room_players",
    "room",
    "user",
    "crossword",
  ]);
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
    await postgres.setup();
    dataSource = postgres.dataSource;

    redisClient = await redisManager.setup();
    await redisManager.flush();
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
  await redisManager.flush();
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
    try {
      await redisManager.flush();
    } catch {
      // ignore cleanup errors
    }
  }

  await Promise.allSettled([
    gameTimeoutQueue.close(),
    gameInactivityQueue.close(),
    statusCleanupQueue.close(),
    emailQueue.close(),
  ]);

  await redisManager.close();
  await postgres.close();
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
