import Redis from 'ioredis';
import { config } from '../config/config';

export class RedisService {
    private publisher: Redis;
    private subscriber: Redis;

    constructor() {
        // Create separate connections for pub/sub
        this.publisher = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
        });

        this.subscriber = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
        });
    }

    // Publish a message to a channel
    async publish(channel: string, message: string) {
        await this.publisher.publish(channel, message);
    }

    // Subscribe to a channel
    subscribe(channel: string, callback: (channel: string, message: string) => void) {
        this.subscriber.subscribe(channel);
        this.subscriber.on('message', callback);
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
