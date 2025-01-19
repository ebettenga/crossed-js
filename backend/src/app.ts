import fastifyStatic from '@fastify/static';
import { join } from 'path';
import fastify, { FastifyInstance } from 'fastify';

// ... existing imports ...

export async function build(opts = {}): Promise<FastifyInstance> {
  const app = fastify(opts);

  // Register static file serving for uploads
  app.register(fastifyStatic, {
    root: join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
  });

  // ... rest of the build function ...

  return app;
}
