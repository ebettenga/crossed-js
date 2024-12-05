import { describe, afterAll, beforeAll, it, expect } from '@jest/globals';
import { fastify } from './setup';

describe('Server', () => {
  beforeAll(async () => {
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should start the server without errors', async () => {
    await fastify.ready();
    const response = await fastify.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
  });
});
