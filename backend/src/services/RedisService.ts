import Redis from "ioredis";
import { config } from "../config/config";
import { v4 as uuidv4 } from "uuid";

export type CachedGameInfo = {
  lastActivityAt: number;
  foundLetters: string[];
  scores: {
    [key: string]: number;
  };
  userGuessCounts: {
    [key: string]: {
      correct: number;
      incorrect: number;
    };
  };
  correctGuessDetails: {
    [key: string]: {
      row: number;
      col: number;
      letter: string;
      timestamp: number;
    }[];
  };
};

export class RedisService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(config.redis.default);
  }

  async cacheGame(gameId: string, game: CachedGameInfo): Promise<void> {
    await this.redis.set(
      gameId,
      JSON.stringify(game),
      "EX",
      config.redis.gameTTL,
    );
  }

  async getGame(gameId: string): Promise<CachedGameInfo | null> {
    const game = await this.redis.get(gameId);
    return game ? JSON.parse(game) : null;
  }

  async setJSON(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const payload = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.redis.set(key, payload, "EX", ttlSeconds);
    } else {
      await this.redis.set(key, payload);
    }
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async deleteKey(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async acquireLock(
    key: string,
    ttlMs = 5000,
    retries = 50,
    retryDelayMs = 100,
  ): Promise<string> {
    const token = uuidv4();
    for (let i = 0; i < retries; i++) {
      const result = await this.redis.set(key, token, "PX", ttlMs, "NX");
      if (result === "OK") return token;
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
    throw new Error(`Failed to acquire lock ${key}`);
  }

  async releaseLock(key: string, token: string): Promise<void> {
    const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
    await this.redis.eval(script, 1, key, token);
  }

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const token = await this.acquireLock(key);
    try {
      return await fn();
    } finally {
      await this.releaseLock(key, token);
    }
  }

  async acquireGameLock(
    roomId: string,
    ttlMs = 5000,
    retries = 50,
    retryDelayMs = 100,
  ): Promise<string> {
    return this.acquireLock(`game_lock:${roomId}`, ttlMs, retries, retryDelayMs);
  }

  async releaseGameLock(roomId: string, token: string): Promise<void> {
    await this.releaseLock(`game_lock:${roomId}`, token);
  }

  // Returns true the first time a guess id is seen, false for retries/replays
  async claimGuessId(
    roomId: number,
    guessId: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const result = await this.redis.set(
      `guess:${roomId}:${guessId}`,
      "1",
      "EX",
      ttlSeconds,
      "NX",
    );
    return result === "OK";
  }

  async releaseGuessId(roomId: number, guessId: string): Promise<void> {
    await this.redis.del(`guess:${roomId}:${guessId}`);
  }

  async close() {
    await this.redis.quit();
  }
}

// Create singleton instance
export const redisService = new RedisService();
