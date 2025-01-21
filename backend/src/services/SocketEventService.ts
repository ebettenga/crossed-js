import { FastifyInstance } from 'fastify';
import { redisService } from './RedisService';

type EventData = {
    type: string;
    data: any;
};

export class SocketEventService {
    private fastify: FastifyInstance;

    constructor(fastify: FastifyInstance) {
        this.fastify = fastify;
    }

    /**
     * Emit an event to specific users across all servers
     * @param userIds Array of user IDs to send the event to
     * @param eventName The name of the event
     * @param data The data to send with the event
     */
    async emitToUsers(userIds: number[], eventName: string, data: any) {
        const message = JSON.stringify({
            type: 'user_event',
            data: {
                eventName,
                data,
                userIds
            }
        });

        await redisService.publish('socket_events', message);
    }

    /**
     * Emit an event to all users in a room across all servers
     * @param roomId The ID of the room
     * @param eventName The name of the event
     * @param data The data to send with the event
     * @param excludeUsers Optional array of user IDs to exclude from the broadcast
     */
    async emitToRoom(roomId: number, eventName: string, data: any, excludeUsers: number[] = []) {
        const message = JSON.stringify({
            type: 'room_event',
            data: {
                eventName,
                data,
                roomId,
                excludeUsers
            }
        });

        await redisService.publish('socket_events', message);
    }

    /**
     * Handle incoming socket events from Redis
     * @param channel The Redis channel
     * @param message The message received
     */
    async handleSocketEvent(channel: string, message: string) {
        try {
            const event: EventData = JSON.parse(message);

            switch (event.type) {
                case 'user_event': {
                    const { eventName, data, userIds } = event.data;

                    // Only emit to users connected to this server
                    for (const userId of userIds) {
                        const isOnThisServer = await redisService.isUserOnThisServer(userId);
                        if (isOnThisServer) {
                            this.fastify.io.to(`user_${userId}`).emit(eventName, data);
                        }
                    }
                    break;
                }

                case 'room_event': {
                    const { eventName, data, roomId, excludeUsers = [] } = event.data;

                    // Check if any excluded users are on this server
                    const excludedSockets = [];
                    for (const userId of excludeUsers) {
                        const isOnThisServer = await redisService.isUserOnThisServer(userId);
                        if (isOnThisServer) {
                            excludedSockets.push(`user_${userId}`);
                        }
                    }

                    // Emit to the room, excluding specified users
                    if (excludedSockets.length > 0) {
                        this.fastify.io.to(roomId.toString())
                            .except(excludedSockets)
                            .emit(eventName, data);
                    } else {
                        this.fastify.io.to(roomId.toString()).emit(eventName, data);
                    }
                    break;
                }
            }
        } catch (error) {
            this.fastify.log.error('Error handling socket event:', error);
        }
    }
}

// Create and export the service factory
export const createSocketEventService = (fastify: FastifyInstance) => {
    return new SocketEventService(fastify);
};
