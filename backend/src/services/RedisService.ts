import Redis from "ioredis";
import { config } from "../config/config";
import { v4 as uuidv4 } from "uuid";

export class RedisService {
  private publisher: Redis;
  private subscriber: Redis;
  private serverId: string;

  constructor() {
    // Generate a unique ID for this server instance
    this.serverId = uuidv4();

    // Create separate connections for pub/sub
    this.publisher = new Redis(config.redis);

    this.subscriber = new Redis(config.redis);
  }

  // Get the server ID
  getServerId(): string {
    return this.serverId;
  }

  // Register a user's socket connection with this server
  async registerUserSocket(userId: number) {
    await this.publisher.hset("user_servers", userId.toString(), this.serverId);
  }

  // Unregister a user's socket connection
  async unregisterUserSocket(userId: number) {
    await this.publisher.hdel("user_servers", userId.toString());
  }

  // Check if a user is connected to this server
  async isUserOnThisServer(userId: number): Promise<boolean> {
    const serverId = await this.publisher.hget(
      "user_servers",
      userId.toString(),
    );
    return serverId === this.serverId;
  }

  // Get the server ID for a user
  async getUserServer(userId: number): Promise<string | null> {
    return await this.publisher.hget("user_servers", userId.toString());
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
