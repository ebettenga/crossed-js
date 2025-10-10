/**
 * Race-condition tests for game inactivity worker vs user input
 * - Mocks BullMQ Worker to avoid Redis
 * - Mocks queues.ts to intercept scheduling
 * - Mocks RedisService and SocketEventService
 * - Uses a fake DataSource/queryRunner to avoid real DB
 */

import type { DataSource } from "typeorm";
import { Room } from "../src/entities/Room";
import { Crossword } from "../src/entities/Crossword";

// Ensure config can parse REDIS_URL before importing any src module that uses config
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Use string-literal module IDs for jest.mock (hoist-safe)
// (removed dynamic require.resolve for hoist safety)
// (removed dynamic require.resolve for hoist safety)
// (removed dynamic require.resolve for hoist safety)

// Mock BullMQ Worker to be fully in-process (no Redis)
jest.mock("bullmq", () => {
  class Worker<T = any> {
    public name: string;
    public processor: (job: any) => Promise<any>;
    public opts: any;
    public handlers: Record<string, Function>;

    constructor(
      name: string,
      processor: (job: any) => Promise<any>,
      opts: any,
    ) {
      this.name = name;
      this.processor = processor;
      this.opts = opts;
      this.handlers = {};
    }
    on(event: string, handler: Function) {
      this.handlers[event] = handler;
    }
    async process(job: any) {
      try {
        const res = await this.processor(job);
        if (this.handlers["completed"]) this.handlers["completed"](job);
        return res;
      } catch (e) {
        if (this.handlers["failed"]) this.handlers["failed"](job, e);
        throw e;
      }
    }
    async close() {
      // no-op
    }
  }
  class Queue {
    add = jest.fn(async (_name: string, _data: any, _opts: any) => ({
      id: "fake-job-id",
    }));
  }
  return { Worker, Queue };
});

// Shared captors
const emittedEvents: Array<{ roomId: number; eventName: string; data: any }> =
  [];

// Mock SocketEventService factory to capture emits
jest.mock("../src/services/SocketEventService", () => {
  const emitToRoom = jest.fn(
    async (roomId: number, eventName: string, data: any) => {
      emittedEvents.push({ roomId, eventName, data });
    },
  );
  return {
    createSocketEventService: () => ({
      emitToRoom,
    }),
    emitToRoom,
  };
});

// Simple in-memory Redis double
type CachedGameInfo = import("../src/services/RedisService").CachedGameInfo;
const redisStore = new Map<string, CachedGameInfo>();

jest.mock("../src/services/RedisService", () => {
  class RedisService {
    getServerId() {
      return "test-server";
    }
    async publish() {
      // no-op for tests
    }
    async getGame(gameId: string) {
      // Return the SAME reference to simulate concurrent mutation visibility
      return redisStore.get(gameId) ?? null;
    }
    cacheGame(gameId: string, game: CachedGameInfo) {
      // Store the same reference; in real Redis this would serialize, but our goal is to observe final state
      redisStore.set(gameId, game);
    }
    async isUserOnThisServer() {
      return true;
    }
  }
  return { RedisService };
});

// Mock queues module: intercept scheduling via gameInactivityQueue.add
const scheduledJobs: Array<{ data: any; opts: any }> = [];
jest.mock("../src/jobs/queues", () => {
  return {
    gameInactivityQueue: {
      add: jest.fn(async (_name: string, data: any, opts: any) => {
        scheduledJobs.push({ data, opts });
        return { id: "scheduled-job" };
      }),
    },
  };
});

// Mock RoomService to avoid DB work during onGameEnd
// (removed dynamic require.resolve for hoist safety)
jest.mock("../src/services/RoomService", () => {
  return {
    RoomService: class {
      constructor(_ds: any) {}
      async onGameEnd(_room: any) {
        // no-op
      }
    },
  };
});
// Import worker factory after mocks/env are in place
const { createGameInactivityWorker } = require(
  "../src/jobs/workers/game-inactivity.worker",
);

// Utilities
function makeCrossword(letterGrid: string[]): Crossword {
  const cw = new Crossword();
  cw.grid = letterGrid;
  cw.gridnums = letterGrid.map((_c, i) => (i + 1).toString());
  cw.row_size = Math.sqrt(letterGrid.length) | 0 || letterGrid.length;
  cw.col_size = cw.row_size;
  cw.clues = { across: ["1. A clue"], down: ["1. A clue"] };
  cw.title = "Test CW";
  cw.author = "Test";
  return cw;
}

function makeRoom(
  roomId: number,
  foundLetters: string[],
  crossword: Crossword,
): Room {
  const room = new Room();
  room.id = roomId;
  room.status = "playing";
  room.players = [{ id: 1, username: "alice", eloRating: 1200 } as any];
  room.crossword = crossword;
  room.scores = { 1: 0 } as any;
  room.created_at = new Date();
  room.completed_at = null as any;
  room.difficulty = "easy";
  room.found_letters = [...foundLetters];
  room.last_activity_at = null as any;
  // Initialize internal cache markers
  (room as any).viewCache = null;
  (room as any).lastModified = 0;
  (room as any).lastViewUpdate = 0;
  return room;
}

function makeFakeDataSource(room: Room) {
  let phase = 0;

  // Single QB reused across calls; supports chaining
  const qb: any = {
    leftJoinAndSelect: () => qb,
    where: () => qb,
    getOne: async () => {
      phase += 1;
      if (phase === 1) {
        // First query returns base room without relations
        const base: any = new Room();
        Object.assign(base, {
          id: room.id,
          status: room.status,
          scores: room.scores,
          found_letters: room.found_letters,
          players: room.players,
          crossword: undefined,
          created_at: room.created_at,
          difficulty: room.difficulty,
          completed_at: room.completed_at,
          last_activity_at: room.last_activity_at,
          createRoomCache: room.createRoomCache.bind(room),
          markModified: room.markModified.bind(room),
          toJSON: room.toJSON.bind(room),
        });
        return base;
      }
      // Second query returns room with relations
      const withRelations: any = new Room();
      Object.assign(withRelations, room);
      return withRelations;
    },
  };

  const repo = {
    createQueryBuilder: jest.fn(() => qb),
  };

  const manager = {
    save: jest.fn(async (_entity: any) => {
      // emulate successful save
    }),
    getRepository: jest.fn(() => repo),
  };

  const fakeRunner = {
    manager,
    connect: jest.fn(async () => {}),
    startTransaction: jest.fn(async () => {}),
    commitTransaction: jest.fn(async () => {}),
    rollbackTransaction: jest.fn(async () => {}),
    release: jest.fn(async () => {}),
  };

  const fakeDataSource: any = {
    isInitialized: true,
    createQueryRunner: () => fakeRunner,
  };

  return { fakeDataSource, fakeRunner };
}

function resetCaptors() {
  emittedEvents.length = 0;
  scheduledJobs.length = 0;
  redisStore.clear();
  jest.clearAllMocks();
}

describe("Game inactivity worker concurrency", () => {
  beforeEach(() => {
    resetCaptors();
    jest.useFakeTimers({ now: Date.now() });
    jest.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test("User input BEFORE job processes: does not reveal, does not pause, next job scheduled", async () => {
    const cw = makeCrossword(["A", "*", "C", "D"]);
    const room = makeRoom(101, ["A", "*", "C", "D"], cw);
    const { fakeDataSource } = makeFakeDataSource(room);

    // Seed redis cache with initial state
    const initialActivity = Date.now();
    const cacheKey = room.id.toString();
    const initialCache: CachedGameInfo = {
      lastActivityAt: initialActivity,
      foundLetters: [...room.found_letters],
      scores: { ...room.scores },
      userGuessCounts: { 1: { correct: 0, incorrect: 0 } },
      correctGuessDetails: { 1: [] },
    };
    redisStore.set(cacheKey, initialCache);

    // Create worker (BullMQ Worker is mocked)
    const fastify: any = {};
    const worker = createGameInactivityWorker(
      fakeDataSource as unknown as DataSource,
      fastify,
    );

    // Simulate user activity after job scheduling but BEFORE processing
    const t0 = initialActivity;
    const t1 = t0 + 1000;
    (redisStore.get(cacheKey) as CachedGameInfo).lastActivityAt = t1;
    // Also simulate a legit user reveal at index 1
    (redisStore.get(cacheKey) as CachedGameInfo).foundLetters[1] = cw.grid![1]; // reveal real letter at index 1

    // Create and process job
    const job = {
      id: "job-1",
      data: { roomId: room.id, lastActivityTimestamp: t0 },
      timestamp: Date.now(),
      processedOn: undefined,
      finishedOn: undefined,
    };

    // Invoke the worker's processor
    await (worker as any).process(job);

    // Assertions:
    // - Gate should suppress inactivity reveal (no game_inactive event)
    const socketMock = require("../src/services/SocketEventService");
    expect(socketMock.emitToRoom).not.toHaveBeenCalledWith(
      room.id,
      "game_inactive",
      expect.anything(),
    );
    // - Found letters remain only reflecting user input, no extra reveal by worker
    const finalCache = redisStore.get(cacheKey)!;
    expect(finalCache.foundLetters).toEqual(["A", cw.grid![1], "C", "D"]);
    // - Next job is scheduled
    expect(scheduledJobs.length).toBe(1);
    expect(scheduledJobs[0].data).toMatchObject({
      roomId: room.id,
      lastActivityTimestamp: expect.any(Number),
    });
  });

  test("No user input (true inactivity): reveals exactly one letter, emits events, schedules next job", async () => {
    const cw = makeCrossword(["A", "B", "C", "D"]);
    const room = makeRoom(202, ["A", "*", "C", "D"], cw);
    const { fakeDataSource } = makeFakeDataSource(room);

    const t0 = Date.now();
    const cacheKey = room.id.toString();
    const cache: CachedGameInfo = {
      lastActivityAt: t0,
      foundLetters: [...room.found_letters],
      scores: { ...room.scores },
      userGuessCounts: { 1: { correct: 0, incorrect: 0 } },
      correctGuessDetails: { 1: [] },
    };
    redisStore.set(cacheKey, cache);

    const fastify: any = {};
    const worker = createGameInactivityWorker(
      fakeDataSource as unknown as DataSource,
      fastify,
    );

    const job = {
      id: "job-2",
      data: { roomId: room.id, lastActivityTimestamp: t0 },
      timestamp: Date.now(),
      processedOn: undefined,
      finishedOn: undefined,
    };

    await (worker as any).process(job);

    // Worker should emit inactivity and room updates
    const socketMock = require("../src/services/SocketEventService");
    const emits = (socketMock.emitToRoom as jest.Mock).mock.calls.filter((
      [_id, evt],
    ) => evt === "game_inactive");
    expect(emits.length).toBe(1);

    // Exactly one letter revealed (index 1 must now be letter from crossword)
    const final = redisStore.get(cacheKey)!;
    expect(final.foundLetters).toEqual(["A", "B", "C", "D"]); // fully solved due to single unsolved position

    // Next job scheduled when status is playing (though puzzle may finish, code still checks status)
    expect(scheduledJobs.length).toBeGreaterThanOrEqual(1);
    expect(scheduledJobs[0].data).toMatchObject({
      roomId: room.id,
      lastActivityTimestamp: expect.any(Number),
    });
  });
});
