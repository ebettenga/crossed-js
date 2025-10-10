import { describe, afterAll, beforeAll, it, expect, jest } from '@jest/globals';
import { fastify } from '../setup';
import { User } from '../../src/entities/User';

describe('GET /users', () => {
  beforeAll(async () => {
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should return a list of users', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/users',
      headers: {
        authorization: 'Bearer test-token',
      },
    });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json())).toBeTruthy();
  });

  it('should return users with the correct structure', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/users',
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    const users = response.json();
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(users)).toBeTruthy();

    if (users.length > 0) {
      users.forEach((user: any) => {
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('username');
      });
    }
  });

  it('should return an empty array if no users exist', async () => {
    // Mock the repository to return an empty array
    jest
      .spyOn(fastify.orm.getRepository(User), 'find')
      .mockResolvedValueOnce([]);

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/users',
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('should handle errors gracefully', async () => {
    // Mock the repository to throw an error
    jest
      .spyOn(fastify.orm.getRepository(User), 'find')
      .mockRejectedValueOnce(new Error('Database error'));

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/users',
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: 'Internal Server Error',
      message: 'Database error',
      statusCode: 500,
    });
  });
});
