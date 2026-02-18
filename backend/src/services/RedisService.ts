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
  private publisher: Redis;
  private subscriber: Redis;
  private serverId: string;

  constructor() {
    // Generate a unique ID for this server instance
    this.serverId = uuidv4();

    // Create separate connections for pub/sub
    this.publisher = new Redis(config.redis.default);
    this.subscriber = new Redis(config.redis.default);
    this.redis = new Redis(config.redis.default);
  }

  // Get the server ID
  getServerId(): string {
    return this.serverId;
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

  // Register a user's socket connection with this server
  async registerUserSocket(userId: number) {
    await this.redis.hset("user_servers", userId.toString(), this.serverId);
  }

  // Unregister a user's socket connection
  async unregisterUserSocket(userId: number) {
    await this.redis.hdel("user_servers", userId.toString());
  }

  // Check if a user is connected to this server
  async isUserOnThisServer(userId: number): Promise<boolean> {
    const serverId = await this.redis.hget(
      "user_servers",
      userId.toString(),
    );
    return serverId === this.serverId;
  }

  // Get the server ID for a user
  async getUserServer(userId: number): Promise<string | null> {
    return await this.redis.hget("user_servers", userId.toString());
  }

  // Publish a message to a channel
  async publish(channel: string, message: string) {
    await this.publisher.publish(channel, message);
  }

  // Subscribe to a channel
  subscribe(
    channel: string,
    callback: (channel: string, message: string) => void,
  ) {
    this.subscriber.subscribe(channel);
    this.subscriber.on("message", callback);
  }

  // Unsubscribe from a channel
  unsubscribe(channel: string) {
    this.subscriber.unsubscribe(channel);
  }

  async acquireGameLock(
    roomId: string,
    ttlMs = 5000,
    retries = 50,
    retryDelayMs = 100,
  ): Promise<string> {
    const token = uuidv4();
    const key = `game_lock:${roomId}`;
    for (let i = 0; i < retries; i++) {
      const result = await this.redis.set(key, token, "PX", ttlMs, "NX");
      if (result === "OK") return token;
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
    throw new Error(`Failed to acquire game lock for room ${roomId}`);
  }

  async releaseGameLock(roomId: string, token: string): Promise<void> {
    const key = `game_lock:${roomId}`;
    const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
    await this.redis.eval(script, 1, key, token);
  }

  // Close connections
  async close() {
    await this.publisher.quit();
    await this.subscriber.quit();
    await this.redis.quit();
  }
}

// Create singleton instance
export const redisService = new RedisService();
