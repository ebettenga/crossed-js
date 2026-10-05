import Redis from "ioredis";
import { RedisService, redisService } from "../../src/services/RedisService";
import { config } from "../../src/config/config";
import { createRedisTestManager } from "../utils/redis";

jest.setTimeout(30000);

const redisManager = createRedisTestManager({
  url: config.redis.default,
  label: "RedisService tests",
});

let adminRedis: Redis;

beforeAll(async () => {
  adminRedis = await redisManager.setup();
});

beforeEach(async () => {
  await redisManager.flush();
});

afterAll(async () => {
  await redisManager.close();
  const globalInstance = redisService as unknown as {
    redis: Redis;
  };
  if (globalInstance.redis.status !== "end") {
    await redisService.close();
  }
});

const createService = () => new RedisService();

describe("RedisService", () => {
  it("caches and retrieves game info with TTL", async () => {
    const service = createService();
    const gameId = "game-1";
    const payload = {
      lastActivityAt: Date.now(),
      foundLetters: ["*", "A", "*"],
      scores: { "1": 10, "2": -2 },
      userGuessCounts: {
        "1": { correct: 3, incorrect: 1 },
        "2": { correct: 0, incorrect: 2 },
      },
      correctGuessDetails: {
        "1": [
          { row: 0, col: 1, letter: "A", timestamp: Date.now() },
        ],
      },
    };

    await service.cacheGame(gameId, payload);

    const raw = await adminRedis.get(gameId);
    expect(raw).toBe(JSON.stringify(payload));

    const ttl = await adminRedis.ttl(gameId);
    expect(ttl).toBeGreaterThan(0);

    const retrieved = await service.getGame(gameId);
    expect(retrieved).toEqual(payload);

    await service.close();
  });

  it("serializes work under withLock across service instances", async () => {
    const serviceA = createService();
    const serviceB = createService();
    const events: string[] = [];

    const run = (service: RedisService, label: string) =>
      service.withLock("lock:test", async () => {
        events.push(`${label}:start`);
        await new Promise((resolve) => setTimeout(resolve, 50));
        events.push(`${label}:end`);
      });

    await Promise.all([run(serviceA, "a"), run(serviceB, "b")]);

    expect(events).toHaveLength(4);
    expect(events[0].split(":")[0]).toBe(events[1].split(":")[0]);
    expect(events[2].split(":")[0]).toBe(events[3].split(":")[0]);
    await expect(adminRedis.get("lock:test")).resolves.toBeNull();

    await serviceA.close();
    await serviceB.close();
  });

  it("releases the lock when the critical section throws", async () => {
    const service = createService();

    await expect(
      service.withLock("lock:throws", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(adminRedis.get("lock:throws")).resolves.toBeNull();

    await service.close();
  });

  it("does not release a lock owned by someone else", async () => {
    const service = createService();

    const token = await service.acquireLock("lock:owned", 5000);
    await service.releaseLock("lock:owned", "not-the-owner");
    await expect(adminRedis.get("lock:owned")).resolves.toBe(token);
    await service.releaseLock("lock:owned", token);
    await expect(adminRedis.get("lock:owned")).resolves.toBeNull();

    await service.close();
  });

  it("claims a guess id exactly once until released", async () => {
    const service = createService();

    const claims = await Promise.all([
      service.claimGuessId(7, "guess-1", 60),
      service.claimGuessId(7, "guess-1", 60),
      service.claimGuessId(7, "guess-1", 60),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);

    const ttl = await adminRedis.ttl("guess:7:guess-1");
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);

    // Same id in another room is independent
    await expect(service.claimGuessId(8, "guess-1", 60)).resolves.toBe(true);

    await service.releaseGuessId(7, "guess-1");
    await expect(service.claimGuessId(7, "guess-1", 60)).resolves.toBe(true);

    await service.close();
  });

  it("closes the underlying redis connection", async () => {
    const service = createService();
    const internal = service as unknown as { redis: Redis };

    await service.close();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(["end", "close"]).toContain(internal.redis.status);
  });
});
