
import { describe, afterAll, beforeAll, it, expect, jest } from '@jest/globals';
import { fastify } from '../setup';
import { Log } from '../../src/entities/Log';

describe('Logs routes', () => {
  beforeAll(async () => {
    await fastify.ready();
  });


  afterAll(async () => {
    await fastify.close();
  });

  it('should get all logs', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/logs',
    });

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json())).toBe(true);
  });

  it('should create a new log', async () => {
    const newLog = {
        log: {"body": "test message"},
        severity: "warning"
    }

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/logs',
      payload: newLog,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject(newLog);
  });

  it('should return an empty array if no logs exist', async () => {
    // Mock the repository to return an empty array
    jest
      .spyOn(fastify.orm.getRepository(Log), 'find')
      .mockResolvedValueOnce([]);

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/logs',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('should handle errors gracefully', async () => {
    // Mock the repository to throw an error
    jest
      .spyOn(fastify.orm.getRepository(Log), 'find')
      .mockRejectedValueOnce(new Error('Database error'));

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/logs',
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: 'Internal Server Error',
      message: 'Database error',
      statusCode: 500,
    });
  });
});
