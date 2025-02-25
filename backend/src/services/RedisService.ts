import Redis from "ioredis";
import { config } from "../config/config";
import { v4 as uuidv4 } from "uuid";

export class RedisService {
  private redis: Redis;

  private serverId: string;

  constructor() {
    // Generate a unique ID for this server instance
    this.serverId = uuidv4();

    // Create separate connections for pub/sub
    this.redis = new Redis(config.redis.default);



  }

  // Get the server ID
  getServerId(): string {
    return this.serverId;
  }

  cacheGame(gameId: string, game: any) {
    // Cache
    this.redis.set(gameId, JSON.stringify(game), "EX", config.redis.gameTTL);
  }

  async getGame(gameId: string) {
    const game = await this.redis.get(gameId);
    return game ? JSON.parse(game) : null;
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

  // Close connections
  async close() {
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}

// Create singleton instance
export const redisService = new RedisService();
