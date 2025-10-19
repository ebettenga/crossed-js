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

  it("tracks user socket presence", async () => {
    const service = createService();
    const userId = 42;

    await service.registerUserSocket(userId);

    const stored = await adminRedis.hget("user_servers", userId.toString());
    expect(stored).toBe(service.getServerId());

    await expect(service.isUserOnThisServer(userId)).resolves.toBe(true);
    await expect(service.getUserServer(userId)).resolves.toBe(
      service.getServerId(),
    );

    await service.unregisterUserSocket(userId);
    const after = await adminRedis.hget("user_servers", userId.toString());
    expect(after).toBeNull();
    await expect(service.isUserOnThisServer(userId)).resolves.toBe(false);

    await service.close();
  });

  it("publishes messages to subscribers", async () => {
    const service = createService();
    const channel = `test-channel-${Date.now()}`;
    const payload = "hello-world";

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timed out waiting for pub/sub message"));
      }, 2000);

      service.subscribe(channel, (receivedChannel, message) => {
        try {
          expect(receivedChannel).toBe(channel);
          expect(message).toBe(payload);
          clearTimeout(timer);
          service.unsubscribe(channel);
          resolve();
        } catch (error) {
          clearTimeout(timer);
          reject(error);
        }
      });

      setTimeout(() => {
        service.publish(channel, payload);
      }, 100);
    });

    await service.close();
  });

  it("exposes a stable unique server id per instance", async () => {
    const serviceA = createService();
    const serviceB = createService();

    const idA1 = serviceA.getServerId();
    const idA2 = serviceA.getServerId();
    const idB = serviceB.getServerId();

    expect(idA1).toBe(idA2);
    expect(idA1).not.toBe(idB);

    await serviceA.close();
    await serviceB.close();
  });

  it("closes all underlying redis connections", async () => {
    const service = createService();
    const internal = service as unknown as {
      redis: Redis;
      publisher: Redis;
      subscriber: Redis;
    };

    await service.close();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(["end", "close"]).toContain(internal.redis.status);
    expect(["end", "close"]).toContain(internal.publisher.status);
    expect(["end", "close"]).toContain(internal.subscriber.status);
  });
});
