import { FastifyInstance } from 'fastify';

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  fastify.get('/health', async () => {
    const isDbConnected = await fastify.orm.isInitialized;
    if (isDbConnected) {
      return { status: 'ok' };
    } else {
      return { status: 'error', message: 'Database connection failed' };
    }
  });

  next();
}
