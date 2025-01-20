import { FastifyPluginAsync } from 'fastify';
import { emailQueue } from '../jobs/queues';

const exampleRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/send-email', async (request, reply) => {
    const { to, subject, body } = request.body as any;

    // Add job to queue
    await emailQueue.add('send-email', {
      to,
      subject,
      body,
    });

    return { status: 'Email job queued successfully' };
  });
};

export default exampleRoutes;
