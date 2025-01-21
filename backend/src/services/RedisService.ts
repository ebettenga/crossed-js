import Redis from 'ioredis';
import { config } from '../config/config';
import { Server } from 'socket.io';
import { fastify } from '../fastify';

export class RedisService {
  private publisher: Redis;
  private subscriber: Redis;
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    console.log('Initializing RedisService');

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

    // Subscribe to game events and user-specific events
    this.subscriber.psubscribe('game_channel:*').then(() => {
      console.log('Redis subscriber initialized and subscribed to game_channel:*');
    }).catch(err => {
      console.error('Failed to subscribe to game channels:', err);
    });

    // Handle incoming messages
    this.subscriber.on('pmessage', (pattern, channel, message) => {
      console.log(`Redis received message on channel ${channel}:`, message);
      try {
        const { event, data } = JSON.parse(message);
        const channelId = channel.split(':')[1];

        console.log(`Broadcasting to channel ${channelId}, event: ${event}`, data);

        // Check if this is a user-specific channel
        if (channel.startsWith('game_channel:user_')) {
          const userId = channelId.replace('user_', '');
          console.log(`Broadcasting to user-specific room: user_${userId}`);
          this.io.to(`user_${userId}`).emit(event, data);
        } else if (event === 'user_status_change') {
          // Handle user status changes globally
          this.io.emit(event, data);
        } else {
          // Get all sockets in the room before broadcasting
          this.io.in(channelId.toString()).fetchSockets().then(sockets => {
            console.log(`Found ${sockets.length} socket(s) in room ${channelId}`);
            // Broadcast to all clients in the game room
            this.io.to(channelId.toString()).emit(event, data);
            console.log(`Broadcast completed for room ${channelId}`);
          }).catch(err => {
            console.error(`Error fetching sockets for room ${channelId}:`, err);
          });
        }
      } catch (error) {
        console.error('Error processing Redis message:', error);
      }
    });

    // Log connection events
    this.subscriber.on('connect', () => {
      console.log('Redis subscriber  connected');
    });

    this.publisher.on('connect', () => {
      console.log('Redis publisher connected');
    });

    // Log connection errors
    this.publisher.on('error', (err) => {
      console.error('Redis Publisher Error:', err);
    });

    this.subscriber.on('error', (err) => {
      console.error('Redis Subscriber Error:', err);
    });
  }

  async publishGameEvent(gameId: number | string, event: string, data: any) {
    const message = JSON.stringify({ event, data });
    console.log(`Publishing to game_channel:${gameId}, event: ${event}`, data);
    try {
      await this.publisher.publish(`game_channel:${gameId}`, message);
      console.log(`Successfully published event ${event} to game_channel:${gameId}`);
    } catch (error) {
      console.error(`Failed to publish event ${event} to game_channel:${gameId}:`, error);
      throw error;
    }
  }

  async cleanup() {
    console.log('Cleaning up Redis connections');
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}
