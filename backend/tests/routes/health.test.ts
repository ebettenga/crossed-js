import { describe, afterAll, beforeAll, it, expect, jest } from '@jest/globals';
import { fastify } from '../setup';

describe('GET /health', () => {
  beforeAll(async () => {

    await fastify.ready();
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 4000));

    await fastify.close();
  });

  it('should return a health check message', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
