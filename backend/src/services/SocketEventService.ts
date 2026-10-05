import { FastifyInstance } from "fastify";

export const userChannel = (userId: number | string) => `user_${userId}`;
export const roomChannel = (roomId: number | string) => roomId.toString();

/**
 * Emits through the Socket.IO adapter, which delivers to matching sockets on
 * every API instance. Payloads cross instances as msgpack, so pass plain
 * objects (e.g. `room.toJSON()`), not entity instances.
 */
export class SocketEventService {
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  async emitToUsers(userIds: number[], eventName: string, data: any) {
    if (userIds.length === 0) return;
    this.fastify.io.to(userIds.map(userChannel)).emit(eventName, data);
  }

  async emitToRoom(
    roomId: number,
    eventName: string,
    data: any,
    excludeUsers: number[] = [],
  ) {
    const target = this.fastify.io.to(roomChannel(roomId));
    if (excludeUsers.length > 0) {
      target.except(excludeUsers.map(userChannel)).emit(eventName, data);
    } else {
      target.emit(eventName, data);
    }
  }

  // Reaches players even if their sockets have not joined the room channel yet
  async emitToRoomAndPlayers(
    roomId: number,
    playerIds: number[],
    eventName: string,
    data: any,
  ) {
    this.fastify.io
      .to([roomChannel(roomId), ...playerIds.map(userChannel)])
      .emit(eventName, data);
  }

  async joinUsersToRoom(userIds: number[], roomId: number) {
    if (userIds.length === 0) return;
    this.fastify.io.in(userIds.map(userChannel)).socketsJoin(roomChannel(roomId));
  }
}

export const createSocketEventService = (fastify: FastifyInstance) => {
  return new SocketEventService(fastify);
};
