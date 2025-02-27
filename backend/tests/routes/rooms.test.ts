import { describe, afterAll, beforeAll, it, expect, jest, xit } from '@jest/globals';
import { fastify } from '../setup';
import { RoomService } from '../../src/services/RoomService';
import { User } from '../../src/entities/User';
import { Room } from '../../src/entities/Room';

describe('Rooms routes', () => {

  beforeAll(async () => {
    await fastify.ready();

  });

  afterAll(async () => {

    await fastify.close();
  });

  it('should get a room by ID', async () => {
    const room = await fastify.orm.getRepository(Room).findOneBy( { difficulty: 'easy' });

    if (!room) {
        throw new Error('Room not found');
    }

    const response = await fastify.inject({
      method: 'GET',
      url: `/api/rooms/${room?.id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('id');
    expect(response.json()).toHaveProperty('found_letters');
    expect(response.json()).toHaveProperty('difficulty');
  });

  it('should join a room', async () => {
      const adminUser = await fastify.orm
      .getRepository(User)
      .findOne({ where: { username: 'testadmin' } });
    const payload = { userId: adminUser?.id, difficulty: 'easy' };

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/rooms/join',
      payload,
    });

    expect(response.statusCode).toBe(200);
  });

  it('should add points after a correct guess', async () => {
    const testRoom = await fastify.orm.getRepository(Room).findOneBy({ difficulty: 'easy' });

    const payload = {
      roomId: testRoom?.id,
      coordinates: { x: 0, y: 0 },
      guess: 'x',
      userId: testRoom?.player_1.id,
    };

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/rooms/guess',
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(testRoom?.player_1_score).toBeLessThan(response.json().player_1_score)
  });

  it('should handle errors gracefully', async () => {
    jest
      .spyOn(RoomService.prototype, 'getRoomById')
      .mockRejectedValueOnce(new Error('Database error'));

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/rooms/1',
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: 'Internal Server Error',
      message: 'Database error',
      statusCode: 500,
    });
  });
});
