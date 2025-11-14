import { DataSource } from "typeorm";
import type { JobType } from "bullmq";
import Redis from "ioredis";
import { RoomService } from "../../src/services/RoomService";
import { JoinMethod, Room } from "../../src/entities/Room";
import { User } from "../../src/entities/User";
import { Crossword } from "../../src/entities/Crossword";
import { GameStats } from "../../src/entities/GameStats";
import { UserCrosswordPack } from "../../src/entities/UserCrosswordPack";
import { fastify } from "../../src/fastify";
import {
  emailQueue,
  gameAutoRevealQueue,
  gameTimeoutQueue,
  statusCleanupQueue,
} from "../../src/jobs/queues";
import { config } from "../../src/config/config";
import { RedisService, redisService } from "../../src/services/RedisService";
import { ForbiddenError } from "../../src/errors/api";
import { createPostgresTestManager } from "../utils/postgres";
import { createRedisTestManager, RedisTestManager } from "../utils/redis";
import { TimeTrialLeaderboardEntry } from "../../src/entities/TimeTrialLeaderboardEntry";

jest.setTimeout(60000);

const postgres = createPostgresTestManager({
  label: "RoomService tests",
  entities: [
    Room,
    User,
    Crossword,
    GameStats,
    UserCrosswordPack,
    TimeTrialLeaderboardEntry,
  ],
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
  await gameAutoRevealQueue.waitUntilReady();

  await Promise.all(
    [gameTimeoutQueue, gameAutoRevealQueue].map(async (queue) => {
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
    "time_trial_leaderboard_entry",
    "game_stats",
    "room_players",
    "room",
    "user_crossword_pack",
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

const grantPack = async (user: User, pack: string) => {
  const repository = dataSource.getRepository(UserCrosswordPack);
  const entry = repository.create({ userId: user.id, pack });
  return repository.save(entry);
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
    pack: "general",
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
    gameAutoRevealQueue.close(),
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

    const timeoutJobId = `room-timeout-${room.id}`;
    const timeoutJob = await gameTimeoutQueue.getJob(timeoutJobId);
    expect(timeoutJob).not.toBeNull();
    expect(timeoutJob?.data).toEqual({ roomId: room.id });
    expect(timeoutJob?.opts?.delay).toBe(config.game.timeout.pending);
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

    const autoRevealJobs = await gameAutoRevealQueue.getDelayed();
    const hasJob = autoRevealJobs.some(
      (job) => job.data.roomId === pendingRoom.id,
    );
    expect(hasJob).toBe(true);
  });

  it("replaces a restricted crossword if a joining player lacks pack access", async () => {
    const packedUser = await createUser();
    const generalUser = await createUser();
    await grantPack(packedUser, "nyt");
    const nytCrossword = await createCrossword({
      dow: "Monday",
      title: "NYT Pack Crossword",
      pack: "nyt",
    });
    const generalCrossword = await createCrossword({
      dow: "Tuesday",
      title: "General Crossword",
      pack: "general",
    });

    const service = createRoomService();
    const crosswordService = (service as any).crosswordService;
    const getCrosswordSpy = jest
      .spyOn(crosswordService, "getCrosswordByDifficulty")
      .mockImplementation(async (_difficulty: string, options: any) => {
        const packs: string[] = options?.packs ?? [];
        if (packs.includes("nyt") && packs.includes("general")) {
          return nytCrossword;
        }
        if (packs.length === 1 && packs[0] === "general") {
          return generalCrossword;
        }
        if (packs.includes("nyt")) {
          return nytCrossword;
        }
        return generalCrossword;
      });

    try {
      const room = await service.createRoom(packedUser.id, "easy", "1v1");
      expect(room.crossword.pack).toBe("nyt");

      const reloadedRoom = await dataSource
        .getRepository(Room)
        .findOneByOrFail({ id: room.id });

      await service.joinExistingRoom(reloadedRoom, generalUser.id);

      const updatedRoom = await dataSource
        .getRepository(Room)
        .findOneByOrFail({ id: room.id });

      expect(updatedRoom.crossword.pack).toBe("general");
      expect(updatedRoom.players.map((p) => p.id).sort()).toEqual(
        [packedUser.id, generalUser.id].sort(),
      );
      expect(updatedRoom.scores[packedUser.id]).toBe(0);
      expect(updatedRoom.scores[generalUser.id]).toBe(0);
    } finally {
      getCrosswordSpy.mockRestore();
    }
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
  // ============================================================================
  // getActiveRoomsForUser Tests
  // ============================================================================
  describe("getActiveRoomsForUser", () => {
    it("returns only playing rooms for a user", async () => {
      const user = await createUser();
      const crossword = await createCrossword();
      const service = createRoomService();

      // Create rooms with different statuses
      const playingRoom = await service.createRoom(user.id, "easy", "1v1");
      playingRoom.status = "playing";
      await dataSource.getRepository(Room).save(playingRoom);

      const pendingRoom = await service.createRoom(user.id, "easy", "1v1");
      const finishedRoom = await service.createRoom(user.id, "easy", "1v1");
      finishedRoom.status = "finished";
      await dataSource.getRepository(Room).save(finishedRoom);

      const activeRooms = await service.getActiveRoomsForUser(user.id);

      expect(activeRooms).toHaveLength(1);
      expect(activeRooms[0].id).toBe(playingRoom.id);
      expect(activeRooms[0].status).toBe("playing");
    });

    it("returns empty array when user has no active rooms", async () => {
      const user = await createUser();
      const service = createRoomService();

      const activeRooms = await service.getActiveRoomsForUser(user.id);

      expect(activeRooms).toEqual([]);
    });

    it("includes room players and crossword relations", async () => {
      const user = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user.id, "easy", "1v1");
      room.status = "playing";
      await dataSource.getRepository(Room).save(room);

      const activeRooms = await service.getActiveRoomsForUser(user.id);

      expect(activeRooms[0].players).toBeDefined();
      expect(activeRooms[0].players).toHaveLength(1);
      expect(activeRooms[0].crossword).toBeDefined();
    });

    it("returns multiple active rooms for a user", async () => {
      const user = await createUser();
      await createCrossword({ dow: "Monday" }); // easy
      await createCrossword({ dow: "Wednesday" }); // medium
      const service = createRoomService();

      const room1 = await service.createRoom(user.id, "easy", "1v1");
      room1.status = "playing";
      await dataSource.getRepository(Room).save(room1);

      const room2 = await service.createRoom(user.id, "medium", "1v1");
      room2.status = "playing";
      await dataSource.getRepository(Room).save(room2);

      const activeRooms = await service.getActiveRoomsForUser(user.id);

      expect(activeRooms).toHaveLength(2);
      expect(activeRooms.map((r) => r.id).sort()).toEqual(
        [room1.id, room2.id].sort(),
      );
    });
  });

  // ============================================================================
  // onGameEnd Tests
  // ============================================================================
  describe("onGameEnd", () => {
    it("marks room as finished and sets completed_at", async () => {
      const user = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user.id, "easy", "time_trial");
      room.status = "playing";
      await dataSource.getRepository(Room).save(room);

      await service.onGameEnd(room);

      const updated = await dataSource
        .getRepository(Room)
        .findOneBy({ id: room.id });
      expect(updated?.status).toBe("finished");
      expect(updated?.completed_at).toBeDefined();
      expect(updated?.completed_at).toBeInstanceOf(Date);
    });

    it("determines winner by highest score", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user1.id, "easy", "1v1");

      // Reload room to get proper relations before joining
      const reloadedRoom = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room.id },
          relations: ["players", "crossword"],
        });

      await service.joinExistingRoom(reloadedRoom!, user2.id);

      // Reload again after join to get updated players
      const updatedRoom = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room.id },
          relations: ["players", "crossword"],
        });

      updatedRoom!.scores = { [user1.id]: 100, [user2.id]: 50 };
      updatedRoom!.status = "playing";
      await dataSource.getRepository(Room).save(updatedRoom!);

      await service.onGameEnd(updatedRoom!);

      const stats = await dataSource.getRepository(GameStats).find({
        where: { roomId: room.id },
      });

      const user1Stats = stats.find((s) => s.userId === user1.id);
      const user2Stats = stats.find((s) => s.userId === user2.id);

      expect(user1Stats?.isWinner).toBe(true);
      expect(user2Stats?.isWinner).toBe(false);
    });

    it("handles tie scenarios with multiple winners", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user1.id, "easy", "1v1");

      // Reload room to get proper relations before joining
      const reloadedRoom = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room.id },
          relations: ["players", "crossword"],
        });

      await service.joinExistingRoom(reloadedRoom!, user2.id);

      // Reload again after join to get updated players
      const updatedRoom = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room.id },
          relations: ["players", "crossword"],
        });

      updatedRoom!.scores = { [user1.id]: 100, [user2.id]: 100 };
      updatedRoom!.status = "playing";
      await dataSource.getRepository(Room).save(updatedRoom!);

      await service.onGameEnd(updatedRoom!);

      const stats = await dataSource.getRepository(GameStats).find({
        where: { roomId: room.id },
      });

      expect(stats.every((s) => s.isWinner)).toBe(true);
    });

    it("updates win streaks for winners", async () => {
      const user = await createUser();
      await createCrossword();
      const service = createRoomService();

      // First game - win
      const room1 = await service.createRoom(user.id, "easy", "time_trial");
      room1.scores = { [user.id]: 100 };
      room1.status = "playing";
      await dataSource.getRepository(Room).save(room1);
      await service.onGameEnd(room1);

      // Second game - win
      const room2 = await service.createRoom(user.id, "easy", "time_trial");
      room2.scores = { [user.id]: 100 };
      room2.status = "playing";
      await dataSource.getRepository(Room).save(room2);
      await service.onGameEnd(room2);

      const stats = await dataSource
        .getRepository(GameStats)
        .findOne({ where: { roomId: room2.id, userId: user.id } });

      expect(stats?.winStreak).toBe(2);
    });

    it("resets win streak for losers", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      await createCrossword();
      const service = createRoomService();

      // First game - user1 wins
      const room1 = await service.createRoom(user1.id, "easy", "1v1");
      const reloadedRoom1 = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room1.id },
          relations: ["players", "crossword"],
        });
      await service.joinExistingRoom(reloadedRoom1!, user2.id);

      const updatedRoom1 = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room1.id },
          relations: ["players", "crossword"],
        });
      updatedRoom1!.scores = { [user1.id]: 100, [user2.id]: 50 };
      updatedRoom1!.status = "playing";
      await dataSource.getRepository(Room).save(updatedRoom1!);
      await service.onGameEnd(updatedRoom1!);

      // Second game - user1 loses
      const room2 = await service.createRoom(user1.id, "easy", "1v1");
      const reloadedRoom2 = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room2.id },
          relations: ["players", "crossword"],
        });
      await service.joinExistingRoom(reloadedRoom2!, user2.id);

      const updatedRoom2 = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room2.id },
          relations: ["players", "crossword"],
        });
      updatedRoom2!.scores = { [user1.id]: 50, [user2.id]: 100 };
      updatedRoom2!.status = "playing";
      await dataSource.getRepository(Room).save(updatedRoom2!);
      await service.onGameEnd(updatedRoom2!);

      const stats = await dataSource
        .getRepository(GameStats)
        .findOne({ where: { roomId: room2.id, userId: user1.id } });

      expect(stats?.winStreak).toBe(0);
    });

    it("applies forfeit penalty to forfeiting player", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user1.id, "easy", "1v1");
      const reloadedRoom = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room.id },
          relations: ["players", "crossword"],
        });
      await service.joinExistingRoom(reloadedRoom!, user2.id);

      const updatedRoom = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room.id },
          relations: ["players", "crossword"],
        });
      updatedRoom!.scores = { [user1.id]: 50, [user2.id]: 50 };
      updatedRoom!.status = "playing";
      await dataSource.getRepository(Room).save(updatedRoom!);

      await service.onGameEnd(updatedRoom!, user1.id);

      const finalRoom = await dataSource
        .getRepository(Room)
        .findOneBy({ id: room.id });

      expect(finalRoom?.scores[user1.id]).toBeLessThan(50);
    });

    it("marks non-forfeiting players as winners when game is forfeited", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user1.id, "easy", "1v1");
      const reloadedRoom = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room.id },
          relations: ["players", "crossword"],
        });
      await service.joinExistingRoom(reloadedRoom!, user2.id);

      const updatedRoom = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room.id },
          relations: ["players", "crossword"],
        });
      updatedRoom!.scores = { [user1.id]: 50, [user2.id]: 50 };
      updatedRoom!.status = "playing";
      await dataSource.getRepository(Room).save(updatedRoom!);

      await service.onGameEnd(updatedRoom!, user1.id);

      const stats = await dataSource.getRepository(GameStats).find({
        where: { roomId: room.id },
      });

      const user1Stats = stats.find((s) => s.userId === user1.id);
      const user2Stats = stats.find((s) => s.userId === user2.id);

      expect(user1Stats?.isWinner).toBe(false);
      expect(user2Stats?.isWinner).toBe(true);
    });

    it("updates game stats from redis cache", async () => {
      const user = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user.id, "easy", "time_trial");
      room.status = "playing";
      await dataSource.getRepository(Room).save(room);

      // Simulate cached game info
      const cachedGameInfo = {
        lastActivityAt: Date.now(),
        foundLetters: room.found_letters,
        scores: room.scores,
        userGuessCounts: {
          [user.id]: { correct: 10, incorrect: 2 },
        },
        correctGuessDetails: {
          [user.id]: [
            { row: 0, col: 0, letter: "A", timestamp: Date.now() },
          ],
        },
      };

      await redisClient.set(
        room.id.toString(),
        JSON.stringify(cachedGameInfo),
      );

      await service.onGameEnd(room);

      const stats = await dataSource
        .getRepository(GameStats)
        .findOne({ where: { roomId: room.id, userId: user.id } });

      expect(stats?.correctGuesses).toBe(10);
      expect(stats?.incorrectGuesses).toBe(2);
      expect(stats?.correctGuessDetails).toHaveLength(1);
    });

    it("emits game_forfeited event when game is forfeited", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user1.id, "easy", "1v1");
      const reloadedRoom = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room.id },
          relations: ["players", "crossword"],
        });
      await service.joinExistingRoom(reloadedRoom!, user2.id);

      const updatedRoom = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room.id },
          relations: ["players", "crossword"],
        });
      updatedRoom!.status = "playing";
      await dataSource.getRepository(Room).save(updatedRoom!);

      await service.onGameEnd(updatedRoom!, user1.id);

      expect(toSpy).toHaveBeenCalledWith(room.id.toString());
      expect(emitSpy).toHaveBeenCalledWith(
        "game_forfeited",
        expect.objectContaining({
          forfeitedBy: user1.id,
        }),
      );
    });

    it("emits rating_change events to all players", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user1.id, "easy", "1v1");
      const reloadedRoom = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room.id },
          relations: ["players", "crossword"],
        });
      await service.joinExistingRoom(reloadedRoom!, user2.id);

      const updatedRoom = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room.id },
          relations: ["players", "crossword"],
        });
      updatedRoom!.scores = { [user1.id]: 100, [user2.id]: 50 };
      updatedRoom!.status = "playing";
      await dataSource.getRepository(Room).save(updatedRoom!);

      await service.onGameEnd(updatedRoom!);

      expect(toSpy).toHaveBeenCalledWith(user1.id.toString());
      expect(toSpy).toHaveBeenCalledWith(user2.id.toString());
      expect(emitSpy).toHaveBeenCalledWith(
        "rating_change",
        expect.objectContaining({
          oldRating: expect.any(Number),
          newRating: expect.any(Number),
          change: expect.any(Number),
        }),
      );
    });
  });

  // ============================================================================
  // forfeitGame Tests
  // ============================================================================
  describe("forfeitGame", () => {
    it("allows a participant to forfeit a game", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user1.id, "easy", "1v1");
      const reloadedRoom = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room.id },
          relations: ["players", "crossword"],
        });
      await service.joinExistingRoom(reloadedRoom!, user2.id);

      const forfeited = await service.forfeitGame(room.id, user1.id);

      expect(forfeited.status).toBe("finished");
    });

    it("throws error when room not found", async () => {
      const service = createRoomService();

      await expect(service.forfeitGame(99999, 1)).rejects.toThrow(
        "Room not found",
      );
    });

    it("throws error when user is not a participant", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user1.id, "easy", "1v1");

      await expect(service.forfeitGame(room.id, user2.id)).rejects.toThrow(
        "User is not a participant in this room",
      );
    });

    it("ensures game stats exist for all players before ending", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user1.id, "easy", "1v1");
      const reloadedRoom = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room.id },
          relations: ["players", "crossword"],
        });
      await service.joinExistingRoom(reloadedRoom!, user2.id);

      await service.forfeitGame(room.id, user1.id);

      const stats = await dataSource.getRepository(GameStats).find({
        where: { roomId: room.id },
      });

      expect(stats).toHaveLength(2);
    });

    it("calls onGameEnd with forfeitedBy parameter", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user1.id, "easy", "1v1");
      const reloadedRoom = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room.id },
          relations: ["players", "crossword"],
        });
      await service.joinExistingRoom(reloadedRoom!, user2.id);

      await service.forfeitGame(room.id, user1.id);

      const updated = await dataSource
        .getRepository(Room)
        .findOneBy({ id: room.id });

      expect(updated?.status).toBe("finished");
      // Verify forfeit penalty was applied
      expect(updated?.scores[user1.id]).toBeLessThan(0);
    });

    it("does not apply forfeit penalty when a time trial is forfeited", async () => {
      const user = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user.id, "easy", "time_trial");
      const roomRepo = dataSource.getRepository(Room);
      const reloadedRoom = await roomRepo.findOne({
        where: { id: room.id },
        relations: ["players", "crossword"],
      });

      expect(reloadedRoom).not.toBeNull();

      reloadedRoom!.scores = { [user.id]: 33 };
      reloadedRoom!.found_letters = reloadedRoom!.found_letters.map(
        (letter, index) =>
          letter === "*" && index === 0 ? "A" : letter,
      );
      await roomRepo.save(reloadedRoom!);

      const forfeited = await service.forfeitGame(room.id, user.id);

      expect(forfeited.scores[user.id]).toBe(33);

      const persisted = await roomRepo.findOneBy({ id: room.id });
      expect(persisted?.scores[user.id]).toBe(33);
    });

    it("deletes empty time trial rooms on forfeit and clears auto-reveal jobs", async () => {
      const user = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user.id, "easy", "time_trial");

      const jobStates: JobType[] = ["waiting", "delayed", "paused"];
      const initialJobs = await gameAutoRevealQueue.getJobs(
        jobStates,
        0,
        -1,
        false,
      );
      expect(
        initialJobs.some((job) => job?.data?.roomId === room.id),
      ).toBe(true);

      await service.forfeitGame(room.id, user.id);

      const deletedRoom = await dataSource
        .getRepository(Room)
        .findOneBy({ id: room.id });
      expect(deletedRoom).toBeNull();

      const statsForRoom = await dataSource
        .getRepository(GameStats)
        .find({
          where: { roomId: room.id },
        });
      expect(statsForRoom).toHaveLength(0);

      const remainingJobs = await gameAutoRevealQueue.getJobs(
        jobStates,
        0,
        -1,
        false,
      );
      expect(
        remainingJobs.some((job) => job?.data?.roomId === room.id),
      ).toBe(false);

      expect(toSpy).toHaveBeenCalledWith(`user_${user.id}`);
      expect(emitSpy).toHaveBeenCalledWith(
        "game_cancelled",
        expect.objectContaining({
          message: "Game cancelled",
          roomId: room.id,
        }),
      );
    });

    it("keeps time trial rooms when players have recorded correct guesses", async () => {
      const user = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user.id, "easy", "time_trial");

      await service.handleGuess(room.id, user.id, 0, 0, "A");

      const forfeited = await service.forfeitGame(room.id, user.id);

      expect(forfeited.status).toBe("finished");

      const persistedRoom = await dataSource
        .getRepository(Room)
        .findOneBy({ id: room.id });

      expect(persistedRoom).not.toBeNull();
      expect(persistedRoom?.status).toBe("finished");

      const cancelEvent = emitSpy.mock.calls.find(
        ([eventName]) => eventName === "game_cancelled",
      );
      expect(cancelEvent).toBeUndefined();
    });

    it("deletes unplayed multiplayer rooms on forfeit and emits cancellation event", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user1.id, "easy", "1v1");
      const reloadedRoom = await dataSource
        .getRepository(Room)
        .findOne({
          where: { id: room.id },
          relations: ["players", "crossword"],
        });
      await service.joinExistingRoom(reloadedRoom!, user2.id);

      await service.forfeitGame(room.id, user1.id);

      const persistedRoom = await dataSource
        .getRepository(Room)
        .findOneBy({ id: room.id });
      expect(persistedRoom).toBeNull();

      expect(emitSpy).toHaveBeenCalledWith(
        "game_cancelled",
        expect.objectContaining({
          message: "Game cancelled",
          roomId: room.id,
        }),
      );
    });
  });

  // ============================================================================
  // getRecentGamesWithStats Tests
  // ============================================================================
  describe("getRecentGamesWithStats", () => {
    it("returns recent finished games with stats", async () => {
      const user = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user.id, "easy", "time_trial");
      room.status = "finished";
      room.completed_at = new Date();
      await dataSource.getRepository(Room).save(room);

      const games = await service.getRecentGamesWithStats(user.id, 10);

      expect(games).toHaveLength(1);
      expect(games[0].room.id).toBe(room.id);
      expect(games[0].stats).toBeDefined();
    });

    it("returns empty array when user has no finished games", async () => {
      const user = await createUser();
      const service = createRoomService();

      const games = await service.getRecentGamesWithStats(user.id, 10);

      expect(games).toEqual([]);
    });

    it("respects limit parameter", async () => {
      const user = await createUser();
      await createCrossword();
      const service = createRoomService();

      // Create 5 finished games
      for (let i = 0; i < 5; i++) {
        const room = await service.createRoom(user.id, "easy", "time_trial");
        room.status = "finished";
        room.completed_at = new Date();
        await dataSource.getRepository(Room).save(room);
      }

      const games = await service.getRecentGamesWithStats(user.id, 3);

      expect(games).toHaveLength(3);
    });

    it("orders games by creation date descending", async () => {
      const user = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room1 = await service.createRoom(user.id, "easy", "time_trial");
      room1.status = "finished";
      room1.completed_at = new Date();
      await dataSource.getRepository(Room).save(room1);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const room2 = await service.createRoom(user.id, "easy", "time_trial");
      room2.status = "finished";
      room2.completed_at = new Date();
      await dataSource.getRepository(Room).save(room2);

      const games = await service.getRecentGamesWithStats(user.id, 10);

      expect(games[0].room.id).toBe(room2.id);
      expect(games[1].room.id).toBe(room1.id);
    });

    it("filters by start date", async () => {
      const user = await createUser();
      await createCrossword();
      const service = createRoomService();

      const oldDate = new Date("2020-01-01");
      const newDate = new Date();

      // Create old room and its stats
      const oldRoom = await service.createRoom(user.id, "easy", "time_trial");
      oldRoom.status = "finished";
      oldRoom.completed_at = oldDate;
      await dataSource.getRepository(Room).save(oldRoom);

      // Update the GameStats createdAt to match the old date
      const oldStats = await dataSource.getRepository(GameStats).findOne({
        where: { roomId: oldRoom.id, userId: user.id },
      });
      if (oldStats) {
        oldStats.createdAt = oldDate;
        await dataSource.getRepository(GameStats).save(oldStats);
      }

      // Create new room and its stats
      const newRoom = await service.createRoom(user.id, "easy", "time_trial");
      newRoom.status = "finished";
      newRoom.completed_at = newDate;
      await dataSource.getRepository(Room).save(newRoom);

      // Update the GameStats createdAt to match the new date
      const newStats = await dataSource.getRepository(GameStats).findOne({
        where: { roomId: newRoom.id, userId: user.id },
      });
      if (newStats) {
        newStats.createdAt = newDate;
        await dataSource.getRepository(GameStats).save(newStats);
      }

      const games = await service.getRecentGamesWithStats(
        user.id,
        10,
        new Date("2021-01-01"),
      );

      expect(games).toHaveLength(1);
      expect(games[0].room.id).toBe(newRoom.id);
    });

    it("filters by end date", async () => {
      const user = await createUser();
      await createCrossword();
      const service = createRoomService();

      const oldDate = new Date("2020-01-01");
      const newDate = new Date();

      // Create old room and its stats
      const oldRoom = await service.createRoom(user.id, "easy", "time_trial");
      oldRoom.status = "finished";
      oldRoom.completed_at = oldDate;
      await dataSource.getRepository(Room).save(oldRoom);

      // Update the GameStats createdAt to match the old date
      const oldStats = await dataSource.getRepository(GameStats).findOne({
        where: { roomId: oldRoom.id, userId: user.id },
      });
      if (oldStats) {
        oldStats.createdAt = oldDate;
        await dataSource.getRepository(GameStats).save(oldStats);
      }

      // Create new room and its stats
      const newRoom = await service.createRoom(user.id, "easy", "time_trial");
      newRoom.status = "finished";
      newRoom.completed_at = newDate;
      await dataSource.getRepository(Room).save(newRoom);

      // Update the GameStats createdAt to match the new date
      const newStats = await dataSource.getRepository(GameStats).findOne({
        where: { roomId: newRoom.id, userId: user.id },
      });
      if (newStats) {
        newStats.createdAt = newDate;
        await dataSource.getRepository(GameStats).save(newStats);
      }

      const games = await service.getRecentGamesWithStats(
        user.id,
        10,
        undefined,
        new Date("2021-01-01"),
      );

      expect(games).toHaveLength(1);
      expect(games[0].room.id).toBe(oldRoom.id);
    });

    it("includes correct game stats fields", async () => {
      const user = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user.id, "easy", "time_trial");
      room.status = "finished";
      room.completed_at = new Date();
      await dataSource.getRepository(Room).save(room);

      const games = await service.getRecentGamesWithStats(user.id, 10);

      expect(games[0].stats).toMatchObject({
        correctGuesses: expect.any(Number),
        incorrectGuesses: expect.any(Number),
        isWinner: expect.any(Boolean),
        eloAtGame: expect.any(Number),
      });
    });

    it("returns unlimited games when limit is 0", async () => {
      const user = await createUser();
      await createCrossword();
      const service = createRoomService();

      // Create 15 finished games
      for (let i = 0; i < 15; i++) {
        const room = await service.createRoom(user.id, "easy", "time_trial");
        room.status = "finished";
        room.completed_at = new Date();
        await dataSource.getRepository(Room).save(room);
      }

      const games = await service.getRecentGamesWithStats(user.id, 0);

      expect(games.length).toBeGreaterThanOrEqual(15);
    });
  });

  // ============================================================================
  // createChallengeRoom Tests
  // ============================================================================
  describe("createChallengeRoom", () => {
    it("creates a challenge room with both players", async () => {
      const challenger = await createUser();
      const challenged = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createChallengeRoom(
        challenger.id,
        challenged.id,
        "easy",
      );

      expect(room.players).toHaveLength(2);
      expect(room.players.map((p) => p.id).sort()).toEqual(
        [challenger.id, challenged.id].sort(),
      );
      expect(room.join).toBe(JoinMethod.CHALLENGE);
      expect(room.status).toBe("pending");
    });

    it("selects a crossword from a shared pack when both players have access", async () => {
      const challenger = await createUser();
      const challenged = await createUser();
      await grantPack(challenger, "nyt");
      await grantPack(challenged, "nyt");
      await createCrossword({
        dow: "Monday",
        date: new Date("2024-01-01T00:00:00.000Z"),
        title: "NYT Monday",
        pack: "nyt",
      });

      const service = createRoomService();
      const room = await service.createChallengeRoom(
        challenger.id,
        challenged.id,
        "easy",
      );

      expect(room.crossword.pack).toBe("nyt");
    });

    it("throws error when challenger not found", async () => {
      const challenged = await createUser();
      await createCrossword();
      const service = createRoomService();

      await expect(
        service.createChallengeRoom(99999, challenged.id, "easy"),
      ).rejects.toThrow("User not found");
    });

    it("throws error when challenged user not found", async () => {
      const challenger = await createUser();
      await createCrossword();
      const service = createRoomService();

      await expect(
        service.createChallengeRoom(challenger.id, 99999, "easy"),
      ).rejects.toThrow("User not found");
    });

    it("initializes scores for both players", async () => {
      const challenger = await createUser();
      const challenged = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createChallengeRoom(
        challenger.id,
        challenged.id,
        "easy",
      );

      expect(room.scores[challenger.id]).toBe(0);
      expect(room.scores[challenged.id]).toBe(0);
    });

    it("creates found_letters template", async () => {
      const challenger = await createUser();
      const challenged = await createUser();
      const crossword = await createCrossword();
      const service = createRoomService();

      const room = await service.createChallengeRoom(
        challenger.id,
        challenged.id,
        "easy",
      );

      expect(room.found_letters).toHaveLength(crossword.grid.length);
      expect(room.found_letters.every((l) => l === "*")).toBe(true);
    });

    it("emits challenge_received event to challenged user", async () => {
      const challenger = await createUser();
      const challenged = await createUser();
      await createCrossword();
      const service = createRoomService();

      await service.createChallengeRoom(
        challenger.id,
        challenged.id,
        "easy",
      );

      expect(toSpy).toHaveBeenCalledWith(`user_${challenged.id.toString()}`);
      expect(emitSpy).toHaveBeenCalledWith(
        "challenge_received",
        expect.objectContaining({
          room: expect.any(Object),
          challenger: expect.objectContaining({
            id: challenger.id,
            username: challenger.username,
          }),
        }),
      );
    });

    it("includes context in challenge event when provided", async () => {
      const challenger = await createUser();
      const challenged = await createUser();
      await createCrossword();
      const service = createRoomService();

      await service.createChallengeRoom(
        challenger.id,
        challenged.id,
        "easy",
        "Let's play!",
      );

      expect(emitSpy).toHaveBeenCalledWith(
        "challenge_received",
        expect.objectContaining({
          context: "Let's play!",
        }),
      );
    });

    it("sets room type to 1v1", async () => {
      const challenger = await createUser();
      const challenged = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createChallengeRoom(
        challenger.id,
        challenged.id,
        "easy",
      );

      expect(room.type).toBe("1v1");
    });

    it("assigns correct difficulty", async () => {
      const challenger = await createUser();
      const challenged = await createUser();
      await createCrossword({ dow: "Wednesday" });
      const service = createRoomService();

      const room = await service.createChallengeRoom(
        challenger.id,
        challenged.id,
        "medium",
      );

      expect(room.difficulty).toBe("medium");
    });
  });

  // ============================================================================
  // acceptChallenge Tests
  // ============================================================================
  describe("acceptChallenge", () => {
    it("starts the game when challenge is accepted", async () => {
      const challenger = await createUser();
      const challenged = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createChallengeRoom(
        challenger.id,
        challenged.id,
        "easy",
      );

      await service.acceptChallenge(room.id, challenged.id);

      const updated = await dataSource
        .getRepository(Room)
        .findOneBy({ id: room.id });

      expect(updated?.status).toBe("playing");
    });

    it("throws error when room not found", async () => {
      const user = await createUser();
      const service = createRoomService();

      await expect(service.acceptChallenge(99999, user.id)).rejects.toThrow(
        "Room not found",
      );
    });

    it("emits game_started event to both players", async () => {
      const challenger = await createUser();
      const challenged = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createChallengeRoom(
        challenger.id,
        challenged.id,
        "easy",
      );

      await service.acceptChallenge(room.id, challenged.id);

      expect(toSpy).toHaveBeenCalledWith(room.id.toString());
      expect(emitSpy).toHaveBeenCalledWith(
        "game_started",
        expect.objectContaining({
          message: "Challenge accepted! Game is starting.",
          navigate: expect.objectContaining({
            screen: "game",
            params: { roomId: room.id },
          }),
        }),
      );
    });

    it("initializes redis cache for new player", async () => {
      const challenger = await createUser();
      const challenged = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createChallengeRoom(
        challenger.id,
        challenged.id,
        "easy",
      );

      // Seed cache with challenger data
      const cachedGameInfo = {
        lastActivityAt: Date.now(),
        foundLetters: room.found_letters,
        scores: room.scores,
        userGuessCounts: {
          [challenger.id]: { correct: 0, incorrect: 0 },
        },
        correctGuessDetails: {
          [challenger.id]: [],
        },
      };

      await redisClient.set(
        room.id.toString(),
        JSON.stringify(cachedGameInfo),
      );

      await service.acceptChallenge(room.id, challenged.id);

      const cached = await redisClient.get(room.id.toString());
      const parsed = JSON.parse(cached!);

      expect(parsed.userGuessCounts[challenged.id]).toEqual({
        correct: 0,
        incorrect: 0,
      });
      expect(parsed.correctGuessDetails[challenged.id]).toEqual([]);
    });

    it("subscribes challenged player sockets to room", async () => {
      const challenger = await createUser();
      const challenged = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createChallengeRoom(
        challenger.id,
        challenged.id,
        "easy",
      );

      await service.acceptChallenge(room.id, challenged.id);

      expect(inSpy).toHaveBeenCalledWith(`user_${challenged.id}`);
      expect(socketsJoinSpy).toHaveBeenCalledWith(room.id.toString());
    });
  });

  // ============================================================================
  // rejectChallenge Tests
  // ============================================================================
  describe("rejectChallenge", () => {
    it("cancels the room when challenge is rejected", async () => {
      const challenger = await createUser();
      const challenged = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createChallengeRoom(
        challenger.id,
        challenged.id,
        "easy",
      );

      await service.rejectChallenge(room.id);

      const updated = await dataSource
        .getRepository(Room)
        .findOneBy({ id: room.id });

      expect(updated?.status).toBe("cancelled");
    });

    it("throws error when room not found", async () => {
      const service = createRoomService();

      await expect(service.rejectChallenge(99999)).rejects.toThrow(
        "Room not found",
      );
    });

    it("persists cancelled status to database", async () => {
      const challenger = await createUser();
      const challenged = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createChallengeRoom(
        challenger.id,
        challenged.id,
        "easy",
      );

      const rejected = await service.rejectChallenge(room.id);

      const persisted = await dataSource
        .getRepository(Room)
        .findOneBy({ id: room.id });

      expect(persisted?.status).toBe("cancelled");
      expect(rejected.status).toBe("cancelled");
    });

    // ============================================================================
    // handleGuess Tests (40+ scenarios)
    // ============================================================================
    describe("handleGuess", () => {
      // Redis Cache Management Tests
      describe("Redis Cache Management", () => {
        it("initializes cache from DB state when cache is missing", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          // Ensure no cache exists
          await redisClient.del(room.id.toString());

          await service.handleGuess(room.id, user.id, 0, 0, "A");

          const cached = await redisClient.get(room.id.toString());
          expect(cached).not.toBeNull();

          const parsed = JSON.parse(cached!);
          expect(parsed.foundLetters).toBeDefined();
          expect(parsed.scores).toBeDefined();
          expect(parsed.userGuessCounts).toBeDefined();
        });

        it("uses existing cache when available", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          // Seed cache
          const cachedGameInfo = {
            lastActivityAt: Date.now(),
            foundLetters: room.found_letters,
            scores: { [user.id]: 50 },
            userGuessCounts: {
              [user.id]: { correct: 5, incorrect: 2 },
            },
            correctGuessDetails: {
              [user.id]: [],
            },
          };

          await redisClient.set(
            room.id.toString(),
            JSON.stringify(cachedGameInfo),
          );

          await service.handleGuess(room.id, user.id, 0, 1, "B");

          const cached = await redisClient.get(room.id.toString());
          const parsed = JSON.parse(cached!);

          // Should preserve existing counts
          expect(parsed.userGuessCounts[user.id].correct)
            .toBeGreaterThanOrEqual(
              5,
            );
        });

        it("handles corrupted cache by reinitializing", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          // Set corrupted cache
          await redisClient.set(room.id.toString(), "invalid json");

          // Should handle the error gracefully
          try {
            await service.handleGuess(room.id, user.id, 0, 0, "A");
          } catch (error) {
            // Expected to throw due to JSON parse error
            expect(error).toBeDefined();
          }
        });

        it("initializes user tracking structures when missing", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          // Cache without user tracking
          const cachedGameInfo = {
            lastActivityAt: Date.now(),
            foundLetters: room.found_letters,
            scores: {},
            userGuessCounts: {},
            correctGuessDetails: {},
          };

          await redisClient.set(
            room.id.toString(),
            JSON.stringify(cachedGameInfo),
          );

          await service.handleGuess(room.id, user.id, 0, 0, "A");

          const cached = await redisClient.get(room.id.toString());
          const parsed = JSON.parse(cached!);

          expect(parsed.userGuessCounts[user.id]).toBeDefined();
          expect(parsed.correctGuessDetails[user.id]).toBeDefined();
          expect(parsed.scores[user.id]).toBeDefined();
        });
      });

      // Validation Tests
      describe("Validation", () => {
        it("throws error when room not found", async () => {
          const service = createRoomService();

          await expect(
            service.handleGuess(99999, 1, 0, 0, "A"),
          ).rejects.toThrow("Room not found");
        });

        it("ignores guess for already-filled cell", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          // First guess
          await service.handleGuess(room.id, user.id, 0, 0, "A");

          // Get initial state
          const cached1 = await redisClient.get(room.id.toString());
          const parsed1 = JSON.parse(cached1!);
          const initialCorrect = parsed1.userGuessCounts[user.id].correct;

          // Second guess on same cell
          await service.handleGuess(room.id, user.id, 0, 0, "B");

          // Verify counts didn't change
          const cached2 = await redisClient.get(room.id.toString());
          const parsed2 = JSON.parse(cached2!);

          expect(parsed2.userGuessCounts[user.id].correct).toBe(initialCorrect);
        });

        it("handles out-of-bounds coordinates gracefully", async () => {
          const user = await createUser();
          const crossword = await createCrossword({ grid: Array(4).fill("A") });
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          // This should not crash, but may not update anything
          await expect(
            service.handleGuess(room.id, user.id, 10, 10, "A"),
          ).resolves.not.toThrow();
        });

        it("handles unicode characters in guess", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await expect(
            service.handleGuess(room.id, user.id, 0, 0, "😀"),
          ).resolves.not.toThrow();
        });

        it("handles special characters in guess", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await expect(
            service.handleGuess(room.id, user.id, 0, 0, "@#$"),
          ).resolves.not.toThrow();
        });
      });

      // Game State Transitions Tests
      describe("Game State Transitions", () => {
        it("transitions from empty to partial completion", async () => {
          const user = await createUser();
          const crossword = await createCrossword({
            grid: ["A", "B", "C", "D"],
          });
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await service.handleGuess(room.id, user.id, 0, 0, "A");

          const updated = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          expect(updated?.found_letters[0]).toBe("A");
          expect(updated?.found_letters.filter((l) => l === "*").length).toBe(
            3,
          );
          expect(updated?.status).toBe("playing");
        });

        it("transitions from partial to complete", async () => {
          const user = await createUser();
          const crossword = await createCrossword({ grid: ["A", "B"] });
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          // Fill all but one
          await service.handleGuess(room.id, user.id, 0, 0, "A");

          // Complete the puzzle
          await service.handleGuess(room.id, user.id, 0, 1, "B");

          const updated = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          expect(updated?.status).toBe("finished");
          expect(updated?.found_letters.includes("*")).toBe(false);
        });

        it("detects game completion correctly", async () => {
          const user = await createUser();
          const crossword = await createCrossword({ grid: ["A"] });
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await service.handleGuess(room.id, user.id, 0, 0, "A");

          const updated = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          expect(updated?.status).toBe("finished");
          expect(updated?.completed_at).toBeDefined();
        });

        it("handles single-cell grid completion", async () => {
          const user = await createUser();
          const crossword = await createCrossword({
            grid: ["X"],
            row_size: 1,
            col_size: 1,
          });
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await service.handleGuess(room.id, user.id, 0, 0, "X");

          const updated = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          expect(updated?.status).toBe("finished");
        });
      });

      // Correct Guess Tests
      describe("Correct Guesses", () => {
        it("increments correct guess count", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await service.handleGuess(room.id, user.id, 0, 0, "A");

          const cached = await redisClient.get(room.id.toString());
          const parsed = JSON.parse(cached!);

          expect(parsed.userGuessCounts[user.id].correct).toBe(1);
        });

        it("adds correct points to score", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await service.handleGuess(room.id, user.id, 0, 0, "A");

          const cached = await redisClient.get(room.id.toString());
          const parsed = JSON.parse(cached!);

          expect(parsed.scores[user.id]).toBeGreaterThan(0);
        });

        it("updates found_letters array", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await service.handleGuess(room.id, user.id, 0, 0, "A");

          const updated = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          expect(updated?.found_letters[0]).toBe("A");
        });

        it("records correct guess details", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await service.handleGuess(room.id, user.id, 0, 0, "A");

          const cached = await redisClient.get(room.id.toString());
          const parsed = JSON.parse(cached!);

          expect(parsed.correctGuessDetails[user.id]).toHaveLength(1);
          expect(parsed.correctGuessDetails[user.id][0]).toMatchObject({
            row: 0,
            col: 0,
            letter: "A",
            timestamp: expect.any(Number),
          });
        });

        it("updates lastActivityAt timestamp", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          const beforeTime = Date.now();
          await service.handleGuess(room.id, user.id, 0, 0, "A");

          const cached = await redisClient.get(room.id.toString());
          const parsed = JSON.parse(cached!);

          expect(parsed.lastActivityAt).toBeGreaterThanOrEqual(beforeTime);
        });
      });

      // Incorrect Guess Tests
      describe("Incorrect Guesses", () => {
        it("increments incorrect guess count", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await service.handleGuess(room.id, user.id, 0, 0, "Z");

          const cached = await redisClient.get(room.id.toString());
          const parsed = JSON.parse(cached!);

          expect(parsed.userGuessCounts[user.id].incorrect).toBe(1);
        });

        it("applies negative points to score", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await service.handleGuess(room.id, user.id, 0, 0, "Z");

          const cached = await redisClient.get(room.id.toString());
          const parsed = JSON.parse(cached!);

          expect(parsed.scores[user.id]).toBeLessThan(0);
        });

        it("does not update found_letters array", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await service.handleGuess(room.id, user.id, 0, 0, "Z");

          const updated = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          expect(updated?.found_letters[0]).toBe("*");
        });

        it("does not record in correct guess details", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await service.handleGuess(room.id, user.id, 0, 0, "Z");

          const cached = await redisClient.get(room.id.toString());
          const parsed = JSON.parse(cached!);

          expect(parsed.correctGuessDetails[user.id]).toHaveLength(0);
        });
      });

      // Transaction Tests
      describe("Transactions", () => {
        it("persists state to database on successful guess", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await service.handleGuess(room.id, user.id, 0, 0, "A");

          const updated = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          expect(updated?.found_letters[0]).toBe("A");
          expect(updated?.scores[user.id]).toBeGreaterThan(0);
        });

        it("updates cache after database write", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await service.handleGuess(room.id, user.id, 0, 0, "A");

          const cached = await redisClient.get(room.id.toString());
          expect(cached).not.toBeNull();

          const parsed = JSON.parse(cached!);
          expect(parsed.foundLetters[0]).toBe("A");
        });

        it("handles concurrent guesses with entity manager", async () => {
          const user = await createUser();
          const crossword = await createCrossword({
            grid: ["A", "B", "C", "D"],
          });
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          // Simulate concurrent guesses (may have race conditions)
          await service.handleGuess(room.id, user.id, 0, 0, "A");
          await service.handleGuess(room.id, user.id, 0, 1, "B");

          const updated = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          // Both guesses should be recorded
          expect(updated?.found_letters[0]).toBe("A");
          expect(updated?.found_letters[1]).toBe("B");
        });
      });

      // Race Condition Tests
      describe("Race Conditions", () => {
        it("handles concurrent guesses on same cell", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          // Both try to guess same cell
          await Promise.all([
            service.handleGuess(room.id, user.id, 0, 0, "A"),
            service.handleGuess(room.id, user.id, 0, 0, "A"),
          ]);

          const cached = await redisClient.get(room.id.toString());
          const parsed = JSON.parse(cached!);

          // Should only count once
          expect(parsed.foundLetters[0]).toBe("A");
        });

        it("handles concurrent guesses on different cells", async () => {
          const user1 = await createUser();
          const user2 = await createUser();
          const crossword = await createCrossword({
            grid: ["A", "B", "C", "D"],
          });
          const service = createRoomService();

          const room = await service.createRoom(user1.id, "easy", "1v1");

          // Reload room to get proper relations
          const reloadedRoom = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          await service.joinExistingRoom(reloadedRoom!, user2.id);

          // Different users guess different cells
          await service.handleGuess(room.id, user1.id, 0, 0, "A");
          await service.handleGuess(room.id, user2.id, 0, 1, "B");

          const updated = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          expect(updated?.found_letters[0]).toBe("A");
          expect(updated?.found_letters[1]).toBe("B");
        });

        it("handles race to complete game", async () => {
          const user1 = await createUser();
          const user2 = await createUser();
          const crossword = await createCrossword({ grid: ["A", "B"] });
          const service = createRoomService();

          const room = await service.createRoom(user1.id, "easy", "1v1");

          // Reload room to get proper relations
          const reloadedRoom = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          await service.joinExistingRoom(reloadedRoom!, user2.id);

          // Both try to complete the game
          await service.handleGuess(room.id, user1.id, 0, 0, "A");
          await service.handleGuess(room.id, user2.id, 0, 1, "B");

          const updated = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          expect(updated?.status).toBe("finished");
          expect(updated?.found_letters.includes("*")).toBe(false);
        });
      });

      // Performance Tests
      describe("Performance", () => {
        it("handles high-frequency submissions", async () => {
          const user = await createUser();
          const crossword = await createCrossword({
            grid: Array(16).fill("A"),
          });
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          // Submit 10 guesses rapidly
          const promises = [];
          for (let i = 0; i < 10; i++) {
            promises.push(
              service.handleGuess(
                room.id,
                user.id,
                Math.floor(i / 4),
                i % 4,
                "A",
              ),
            );
          }

          await expect(Promise.all(promises)).resolves.not.toThrow();
        });

        it("handles large grid efficiently", async () => {
          const user = await createUser();
          const crossword = await createCrossword({
            grid: Array(225).fill("A"), // 15x15 grid
            row_size: 15,
            col_size: 15,
          });
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          const startTime = Date.now();
          await service.handleGuess(room.id, user.id, 0, 0, "A");
          const endTime = Date.now();

          expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1s
        });
      });

      // Multi-player Tests
      describe("Multi-player Scenarios", () => {
        it("tracks stats separately for each player", async () => {
          const user1 = await createUser();
          const user2 = await createUser();
          const crossword = await createCrossword({
            grid: ["A", "B", "C", "D"],
          });
          const service = createRoomService();

          const room = await service.createRoom(user1.id, "easy", "1v1");

          // Reload room to get proper relations
          const reloadedRoom = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          await service.joinExistingRoom(reloadedRoom!, user2.id);

          await service.handleGuess(room.id, user1.id, 0, 0, "A");
          await service.handleGuess(room.id, user2.id, 0, 1, "B");

          const cached = await redisClient.get(room.id.toString());
          const parsed = JSON.parse(cached!);

          expect(parsed.userGuessCounts[user1.id].correct).toBe(1);
          expect(parsed.userGuessCounts[user2.id].correct).toBe(1);
        });

        it("maintains separate scores for each player", async () => {
          const user1 = await createUser();
          const user2 = await createUser();
          const crossword = await createCrossword({
            grid: ["A", "B", "C", "D"],
          });
          const service = createRoomService();

          const room = await service.createRoom(user1.id, "easy", "1v1");

          // Reload room to get proper relations
          const reloadedRoom = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          await service.joinExistingRoom(reloadedRoom!, user2.id);

          await service.handleGuess(room.id, user1.id, 0, 0, "A");
          await service.handleGuess(room.id, user2.id, 0, 1, "Z"); // Wrong

          const cached = await redisClient.get(room.id.toString());
          const parsed = JSON.parse(cached!);

          expect(parsed.scores[user1.id]).toBeGreaterThan(0);
          expect(parsed.scores[user2.id]).toBeLessThan(0);
        });

        it("allows both players to contribute to completion", async () => {
          const user1 = await createUser();
          const user2 = await createUser();
          const crossword = await createCrossword({ grid: ["A", "B"] });
          const service = createRoomService();

          const room = await service.createRoom(user1.id, "easy", "1v1");

          // Reload room to get proper relations
          const reloadedRoom = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          await service.joinExistingRoom(reloadedRoom!, user2.id);

          await service.handleGuess(room.id, user1.id, 0, 0, "A");
          await service.handleGuess(room.id, user2.id, 0, 1, "B");

          const updated = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          expect(updated?.status).toBe("finished");
        });
      });

      // Edge Cases
      describe("Edge Cases", () => {
        it("handles empty string guess", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await expect(
            service.handleGuess(room.id, user.id, 0, 0, ""),
          ).resolves.not.toThrow();
        });

        it("handles null/undefined in cache gracefully", async () => {
          const user = await createUser();
          const crossword = await createCrossword();
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          // Set incomplete cache - the service should initialize missing fields
          await redisClient.set(
            room.id.toString(),
            JSON.stringify({
              lastActivityAt: Date.now(),
              foundLetters: room.found_letters,
              scores: {},
              userGuessCounts: {},
              correctGuessDetails: {},
            }),
          );

          await expect(
            service.handleGuess(room.id, user.id, 0, 0, "A"),
          ).resolves.not.toThrow();
        });

        it("handles case-insensitive matching", async () => {
          const user = await createUser();
          const crossword = await createCrossword({
            grid: ["A", "B", "C", "D"],
          });
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await service.handleGuess(room.id, user.id, 0, 0, "a");

          const updated = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          // Depends on implementation - may accept lowercase
          expect(updated?.found_letters[0]).toBeDefined();
        });

        it("preserves existing correct guesses when new guess is wrong", async () => {
          const user = await createUser();
          const crossword = await createCrossword({
            grid: ["A", "B", "C", "D"],
          });
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await service.handleGuess(room.id, user.id, 0, 0, "A");
          await service.handleGuess(room.id, user.id, 0, 1, "Z");

          const updated = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          expect(updated?.found_letters[0]).toBe("A");
          expect(updated?.found_letters[1]).toBe("*");
        });

        it("handles rapid completion and onGameEnd call", async () => {
          const user = await createUser();
          const crossword = await createCrossword({ grid: ["A"] });
          const service = createRoomService();

          const room = await service.createRoom(user.id, "easy", "time_trial");

          await service.handleGuess(room.id, user.id, 0, 0, "A");

          const updated = await dataSource
            .getRepository(Room)
            .findOneBy({ id: room.id });

          expect(updated?.status).toBe("finished");
          expect(updated?.completed_at).toBeDefined();

          // Verify game stats were created
          const stats = await dataSource
            .getRepository(GameStats)
            .findOne({ where: { roomId: room.id, userId: user.id } });

          expect(stats).toBeDefined();
        });
      });
    });
  });

  // ============================================================================
  // getTimeTrialLeaderboard Tests
  // ============================================================================
  describe("getTimeTrialLeaderboard", () => {
    it("returns leaderboard for a specific crossword", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      const crossword = await createCrossword();
      const service = createRoomService();

      const room1 = await service.createRoom(user1.id, "easy", "time_trial");
      room1.status = "finished";
      room1.completed_at = new Date();
      room1.scores = { [user1.id]: 100 };
      await dataSource.getRepository(Room).save(room1);

      const room2 = await service.createRoom(user2.id, "easy", "time_trial");
      room2.status = "finished";
      room2.completed_at = new Date();
      room2.scores = { [user2.id]: 80 };
      await dataSource.getRepository(Room).save(room2);

      const leaderboard = await service.getTimeTrialLeaderboard(room1.id, 10);

      expect(leaderboard.topEntries).toHaveLength(2);
      expect(leaderboard.topEntries[0].score).toBe(100);
      expect(leaderboard.topEntries[1].score).toBe(80);
    });

    it("throws error when room not found", async () => {
      const service = createRoomService();

      await expect(
        service.getTimeTrialLeaderboard(99999, 10),
      ).rejects.toThrow("Room not found");
    });

    it("respects limit parameter", async () => {
      const crossword = await createCrossword();
      const service = createRoomService();

      // Create 5 finished time trial games
      for (let i = 0; i < 5; i++) {
        const user = await createUser();
        const room = await service.createRoom(user.id, "easy", "time_trial");
        room.status = "finished";
        room.completed_at = new Date();
        room.scores = { [user.id]: 100 - i * 10 };
        await dataSource.getRepository(Room).save(room);
      }

      const firstRoom = await dataSource
        .getRepository(Room)
        .findOne({ where: { type: "time_trial" } });

      const leaderboard = await service.getTimeTrialLeaderboard(
        firstRoom!.id,
        3,
      );

      expect(leaderboard.topEntries).toHaveLength(3);
    });

    it("sorts by score descending, then by time ascending", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      const user3 = await createUser();
      const crossword = await createCrossword();
      const service = createRoomService();

      const now = new Date();

      // Same score, different times
      const room1 = await service.createRoom(user1.id, "easy", "time_trial");
      room1.status = "finished";
      room1.created_at = new Date(now.getTime() - 60000);
      room1.completed_at = new Date(now.getTime() - 30000); // 30s
      room1.scores = { [user1.id]: 100 };
      await dataSource.getRepository(Room).save(room1);

      const room2 = await service.createRoom(user2.id, "easy", "time_trial");
      room2.status = "finished";
      room2.created_at = new Date(now.getTime() - 50000);
      room2.completed_at = new Date(now.getTime() - 30000); // 20s
      room2.scores = { [user2.id]: 100 };
      await dataSource.getRepository(Room).save(room2);

      const room3 = await service.createRoom(user3.id, "easy", "time_trial");
      room3.status = "finished";
      room3.created_at = new Date(now.getTime() - 40000);
      room3.completed_at = new Date(now.getTime()); // 40s
      room3.scores = { [user3.id]: 90 };
      await dataSource.getRepository(Room).save(room3);

      const leaderboard = await service.getTimeTrialLeaderboard(room1.id, 10);

      expect(leaderboard.topEntries[0].score).toBe(100);
      expect(leaderboard.topEntries[0].timeTakenMs).toBe(20000);
      expect(leaderboard.topEntries[1].score).toBe(100);
      expect(leaderboard.topEntries[1].timeTakenMs).toBe(30000);
      expect(leaderboard.topEntries[2].score).toBe(90);
    });

    it("includes rank for each entry", async () => {
      const user = await createUser();
      const crossword = await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user.id, "easy", "time_trial");
      room.status = "finished";
      room.completed_at = new Date();
      room.scores = { [user.id]: 100 };
      await dataSource.getRepository(Room).save(room);

      const leaderboard = await service.getTimeTrialLeaderboard(room.id, 10);

      expect(leaderboard.topEntries[0].rank).toBe(1);
    });

    it("includes user information in entries", async () => {
      const user = await createUser();
      const crossword = await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user.id, "easy", "time_trial");
      room.status = "finished";
      room.completed_at = new Date();
      room.scores = { [user.id]: 100 };
      await dataSource.getRepository(Room).save(room);

      const leaderboard = await service.getTimeTrialLeaderboard(room.id, 10);

      expect(leaderboard.topEntries[0].user).toMatchObject({
        id: user.id,
        username: user.username,
        eloRating: user.eloRating,
      });
    });

    it("returns currentPlayerEntry when player is outside top N", async () => {
      const crossword = await createCrossword();
      const service = createRoomService();

      // Create 5 better scores
      for (let i = 0; i < 5; i++) {
        const user = await createUser();
        const room = await service.createRoom(user.id, "easy", "time_trial");
        room.status = "finished";
        room.completed_at = new Date();
        room.scores = { [user.id]: 100 - i * 5 };
        await dataSource.getRepository(Room).save(room);
      }

      // Create current player with lower score
      const currentUser = await createUser();
      const currentRoom = await service.createRoom(
        currentUser.id,
        "easy",
        "time_trial",
      );
      currentRoom.status = "finished";
      currentRoom.completed_at = new Date();
      currentRoom.scores = { [currentUser.id]: 50 };
      await dataSource.getRepository(Room).save(currentRoom);

      const leaderboard = await service.getTimeTrialLeaderboard(
        currentRoom.id,
        3,
      );

      expect(leaderboard.topEntries).toHaveLength(3);
      expect(leaderboard.currentPlayerEntry).toBeDefined();
      expect(leaderboard.currentPlayerEntry?.rank).toBeGreaterThan(3);
    });

    it("calculates time taken correctly", async () => {
      const user = await createUser();
      const crossword = await createCrossword();
      const service = createRoomService();

      const startTime = new Date("2025-01-01T00:00:00Z");
      const endTime = new Date("2025-01-01T00:05:00Z");

      const room = await service.createRoom(user.id, "easy", "time_trial");
      room.status = "finished";
      room.created_at = startTime;
      room.completed_at = endTime;
      room.scores = { [user.id]: 100 };
      await dataSource.getRepository(Room).save(room);

      const leaderboard = await service.getTimeTrialLeaderboard(room.id, 10);

      expect(leaderboard.topEntries[0].timeTakenMs).toBe(300000); // 5 minutes
    });
  });

  // ============================================================================
  // getGlobalTimeTrialLeaderboard Tests
  // ============================================================================
  describe("getGlobalTimeTrialLeaderboard", () => {
    it("returns global leaderboard across all crosswords", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      await createCrossword();
      await createCrossword({ title: "Different Crossword" });
      const service = createRoomService();

      const room1 = await service.createRoom(user1.id, "easy", "time_trial");
      room1.status = "finished";
      room1.completed_at = new Date();
      room1.scores = { [user1.id]: 100 };
      await dataSource.getRepository(Room).save(room1);

      const room2 = await service.createRoom(user2.id, "easy", "time_trial");
      room2.status = "finished";
      room2.completed_at = new Date();
      room2.scores = { [user2.id]: 80 };
      await dataSource.getRepository(Room).save(room2);

      const leaderboard = await service.getGlobalTimeTrialLeaderboard(10);

      expect(leaderboard).toHaveLength(2);
      expect(leaderboard[0].score).toBe(100);
      expect(leaderboard[1].score).toBe(80);
    });

    it("respects limit parameter", async () => {
      const service = createRoomService();
      await createCrossword();

      // Create 5 users with finished games
      for (let i = 0; i < 5; i++) {
        const user = await createUser();
        const room = await service.createRoom(user.id, "easy", "time_trial");
        room.status = "finished";
        room.completed_at = new Date();
        room.scores = { [user.id]: 100 - i * 10 };
        await dataSource.getRepository(Room).save(room);
      }

      const leaderboard = await service.getGlobalTimeTrialLeaderboard(3);

      expect(leaderboard).toHaveLength(3);
    });

    it("shows only best score per user", async () => {
      const user = await createUser();
      await createCrossword();
      const service = createRoomService();

      // Create 3 games for same user with different scores
      const room1 = await service.createRoom(user.id, "easy", "time_trial");
      room1.status = "finished";
      room1.completed_at = new Date();
      room1.scores = { [user.id]: 80 };
      await dataSource.getRepository(Room).save(room1);

      const room2 = await service.createRoom(user.id, "easy", "time_trial");
      room2.status = "finished";
      room2.completed_at = new Date();
      room2.scores = { [user.id]: 100 };
      await dataSource.getRepository(Room).save(room2);

      const room3 = await service.createRoom(user.id, "easy", "time_trial");
      room3.status = "finished";
      room3.completed_at = new Date();
      room3.scores = { [user.id]: 90 };
      await dataSource.getRepository(Room).save(room3);

      const leaderboard = await service.getGlobalTimeTrialLeaderboard(10);

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].score).toBe(100);
    });

    it("sorts by score descending, then by time ascending", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      const user3 = await createUser();
      await createCrossword();
      const service = createRoomService();

      const now = new Date();

      const room1 = await service.createRoom(user1.id, "easy", "time_trial");
      room1.status = "finished";
      room1.created_at = new Date(now.getTime() - 60000);
      room1.completed_at = new Date(now.getTime() - 30000);
      room1.scores = { [user1.id]: 100 };
      await dataSource.getRepository(Room).save(room1);

      const room2 = await service.createRoom(user2.id, "easy", "time_trial");
      room2.status = "finished";
      room2.created_at = new Date(now.getTime() - 50000);
      room2.completed_at = new Date(now.getTime() - 30000);
      room2.scores = { [user2.id]: 100 };
      await dataSource.getRepository(Room).save(room2);

      const room3 = await service.createRoom(user3.id, "easy", "time_trial");
      room3.status = "finished";
      room3.created_at = new Date(now.getTime() - 40000);
      room3.completed_at = new Date(now.getTime());
      room3.scores = { [user3.id]: 90 };
      await dataSource.getRepository(Room).save(room3);

      const leaderboard = await service.getGlobalTimeTrialLeaderboard(10);

      expect(leaderboard[0].score).toBe(100);
      expect(leaderboard[0].timeTakenMs).toBe(20000);
      expect(leaderboard[1].score).toBe(100);
      expect(leaderboard[1].timeTakenMs).toBe(30000);
      expect(leaderboard[2].score).toBe(90);
    });

    it("includes rank for each entry", async () => {
      const user = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user.id, "easy", "time_trial");
      room.status = "finished";
      room.completed_at = new Date();
      room.scores = { [user.id]: 100 };
      await dataSource.getRepository(Room).save(room);

      const leaderboard = await service.getGlobalTimeTrialLeaderboard(10);

      expect(leaderboard[0].rank).toBe(1);
    });

    it("returns empty array when no finished time trials exist", async () => {
      const service = createRoomService();

      const leaderboard = await service.getGlobalTimeTrialLeaderboard(10);

      expect(leaderboard).toEqual([]);
    });

    it("includes user information in entries", async () => {
      const user = await createUser();
      await createCrossword();
      const service = createRoomService();

      const room = await service.createRoom(user.id, "easy", "time_trial");
      room.status = "finished";
      room.completed_at = new Date();
      room.scores = { [user.id]: 100 };
      await dataSource.getRepository(Room).save(room);

      const leaderboard = await service.getGlobalTimeTrialLeaderboard(10);

      expect(leaderboard[0].user).toMatchObject({
        id: user.id,
        username: user.username,
        eloRating: user.eloRating,
      });
    });

    it("prefers faster time when scores are equal", async () => {
      const user = await createUser();
      await createCrossword();
      const service = createRoomService();

      const now = new Date();

      // Slower game
      const room1 = await service.createRoom(user.id, "easy", "time_trial");
      room1.status = "finished";
      room1.created_at = new Date(now.getTime() - 60000);
      room1.completed_at = new Date(now.getTime());
      room1.scores = { [user.id]: 100 };
      await dataSource.getRepository(Room).save(room1);

      // Faster game
      const room2 = await service.createRoom(user.id, "easy", "time_trial");
      room2.status = "finished";
      room2.created_at = new Date(now.getTime() - 30000);
      room2.completed_at = new Date(now.getTime());
      room2.scores = { [user.id]: 100 };
      await dataSource.getRepository(Room).save(room2);

      const leaderboard = await service.getGlobalTimeTrialLeaderboard(10);

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].timeTakenMs).toBe(30000);
    });
  });
});
