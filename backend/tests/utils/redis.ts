import Redis from "ioredis";
import type { RedisOptions } from "ioredis";

/**
 * Lightweight manager for creating and cleaning a shared Redis connection in tests.
 * Ensures a flushed database before every spec and handles teardown.
 */

export type RedisTestManagerOptions = {
  url?: string | RedisOptions;
  label?: string;
};

export class RedisTestManager {
  private clientInstance: Redis | null = null;
  private readonly connectionOptions: string | RedisOptions;
  readonly label: string;

  constructor({ url, label }: RedisTestManagerOptions = {}) {
    this.connectionOptions =
      url || process.env.TEST_REDIS_URL || "redis://127.0.0.1:6379";
    this.label = label || "Redis test environment";
  }

  get client(): Redis {
    if (!this.clientInstance) {
      throw new Error(
        `${this.label}: Redis client accessed before setup. Call setup() first.`,
      );
    }
    return this.clientInstance;
  }

  async setup(): Promise<Redis> {
    if (this.clientInstance) {
      return this.clientInstance;
    }

    if (typeof this.connectionOptions === "string") {
      this.clientInstance = new Redis(this.connectionOptions);
    } else {
      this.clientInstance = new Redis(this.connectionOptions);
    }
    await this.clientInstance.flushdb();
    return this.clientInstance;
  }

  async flush(): Promise<void> {
    await this.client.flushdb();
  }

  async close(): Promise<void> {
    if (this.clientInstance) {
      await this.clientInstance.quit();
      this.clientInstance = null;
    }
  }
}

export const createRedisTestManager = (
  options?: RedisTestManagerOptions,
): RedisTestManager => new RedisTestManager(options);
