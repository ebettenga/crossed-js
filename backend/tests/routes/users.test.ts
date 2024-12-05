import { fastify } from '../setup';

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
    });

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json())).toBe(true);
  });
});