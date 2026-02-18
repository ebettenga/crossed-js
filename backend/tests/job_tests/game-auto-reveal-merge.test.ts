/**
 * Concurrency test: user input occurs immediately after the auto-reveal worker exposes
 * a letter, but before the transaction commits. We simulate this by mutating the
 * cachedGameInfo within the mocked SocketEventService.emitToRoom when the worker emits
 * the legacy "game_inactive" event.
 *
 * This validates:
 * - The game is not paused.
 * - The final persisted/cached state reflects both the worker's reveal and the user's input.
 * - Next auto-reveal job is scheduled normally.
 */

import type { DataSource } from "typeorm";
import { Room } from "../../src/entities/Room";
import { Crossword } from "../../src/entities/Crossword";

// Ensure config can parse REDIS_URL before importing any src module that uses config
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

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

// Simple in-memory Redis double
type CachedGameInfo = import("../../src/services/RedisService").CachedGameInfo;
const redisStore = new Map<string, CachedGameInfo>();

// Mock SocketEventService factory: mutate cache on "game_inactive" to simulate user input
jest.mock("../../src/services/SocketEventService", () => {
  const emitToRoom = jest.fn(
    async (roomId: number, eventName: string, data: any) => {
      emittedEvents.push({ roomId, eventName, data });

      // Simulate a user input happening immediately after an auto-reveal tick
      // but before transaction commit. We mutate the same cachedGameInfo reference.
      if (eventName === "game_inactive") {
        const cache = redisStore.get(roomId.toString());
        if (cache) {
          // Advance lastActivityAt and reveal another unsolved letter (index 2)
          cache.lastActivityAt = Math.max(cache.lastActivityAt, Date.now()) + 1;
          // Safeguard: ensure index 2 exists and is unsolved
          if (
            Array.isArray(cache.foundLetters) && cache.foundLetters[2] === "*"
          ) {
            // We'll need the crossword grid to set the correct letter; we do not have it here,
            // but the worker will pick index 1 (due to Math.random override) and we pick index 2 here.
            // The tests set crossword so grid[2] exists and is "C".
            cache.foundLetters[2] = "C";
          }
        }
      }
    },
  );
  return {
    createSocketEventService: () => ({
      emitToRoom,
    }),
    emitToRoom,
  };
});

// Mock RedisService to use our in-memory store
jest.mock("../../src/services/RedisService", () => {
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
      // Store the same reference; in real Redis this would serialize, but we want to see merged effects
      redisStore.set(gameId, game);
    }
    async isUserOnThisServer() {
      return true;
    }
    async acquireGameLock() {
      return "test-lock-token";
    }
    async releaseGameLock() {}
  }
  return { RedisService };
});

// Mock queues module: intercept scheduling via gameAutoRevealQueue.add
const scheduledJobs: Array<{ data: any; opts: any }> = [];
jest.mock("../../src/jobs/queues", () => {
  return {
    gameAutoRevealQueue: {
      add: jest.fn(async (_name: string, data: any, opts: any) => {
        scheduledJobs.push({ data, opts });
        return { id: "scheduled-job" };
      }),
    },
  };
});

// Mock RoomService to avoid DB work during onGameEnd
jest.mock("../../src/services/RoomService", () => {
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
const { createGameAutoRevealWorker } = require(
  "../../src/jobs/workers/game-auto-reveal.worker",
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

describe("Game auto-reveal worker merge with concurrent user input", () => {
  const realRandom = Math.random;

  beforeEach(() => {
    resetCaptors();
    jest.useFakeTimers({ now: Date.now() });
    jest.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
    // Force findRandomUnsolvedLetter to pick the first unsolved index deterministically
    // In worker: it picks Math.floor(Math.random() * unsolvedPositions.length)
    // With 2 unsolved positions, returning 0 picks index 1 (the first "*").
    // We'll then simulate the user revealing index 2 in emitToRoom mock.
    // @ts-ignore
    global.Math.random = () => 0;
  });

  afterEach(() => {
    jest.useRealTimers();
    // @ts-ignore
    global.Math.random = realRandom;
  });

  test("Worker reveal + user input merges correctly and next job is scheduled", async () => {
    // Grid has 2 unsolved letters: indices 1 ('B') and 2 ('C')
    const cw = makeCrossword(["A", "B", "C", "D"]);
    const room = makeRoom(303, ["A", "*", "*", "D"], cw);
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
    const worker = createGameAutoRevealWorker(
      fakeDataSource as unknown as DataSource,
      fastify,
    );

    const job = {
      id: "job-merge-1",
      data: { roomId: room.id, lastActivityTimestamp: t0 },
      timestamp: Date.now(),
      processedOn: undefined,
      finishedOn: undefined,
    };

    await (worker as any).process(job);

    // Assertions:
    // 1) Both reveals are present: worker revealed index 1 ("B"), user (mock) revealed index 2 ("C")
    const final = redisStore.get(cacheKey)!;
    expect(final.foundLetters).toEqual(["A", "B", "C", "D"]);

    // 2) We saw both "game_inactive" and "room" emissions
    const socketMock = require("../../src/services/SocketEventService");
    const inactiveCalls = (socketMock.emitToRoom as jest.Mock).mock.calls
      .filter(
        ([_id, evt]) => evt === "game_inactive",
      );
    const roomCalls = (socketMock.emitToRoom as jest.Mock).mock.calls.filter(
      ([_id, evt]) => evt === "room",
    );
    expect(inactiveCalls.length).toBe(1);
    expect(roomCalls.length).toBe(1);

    // 3) Next job scheduled normally
    expect(scheduledJobs.length).toBeGreaterThanOrEqual(1);
    expect(scheduledJobs[0].data).toMatchObject({
      roomId: room.id,
      lastActivityTimestamp: expect.any(Number),
    });
  });
});
