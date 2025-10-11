import { AuthService } from '../../services/AuthService';
import { User } from '../../entities/User';

export default async function (fastify, opts) {
  const authService = new AuthService(fastify.orm);
  fastify.decorateRequest('user', null);
  fastify.addHook('preHandler', async (request, reply) => {
    const authHeader =
      request.headers['authorization'] || request.headers['Authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7, authHeader.length);
      try {
        const user = await authService.verify(fastify, { token });
        const userRecord = await fastify.orm
          .getRepository(User)
          .findOne({ where: { id: user.sub } });

        if (!userRecord) {
          reply.code(403).send({ error: 'Unauthorized' });
          return;
        }
        request.user = userRecord;
      } catch (err) {
        fastify.log.error('Token verification failed:', err);
        reply.code(403).send({ error: 'Unauthorized' });
      }
    } else {
      fastify.log.warn('Authorization header missing or malformed');
      reply.code(403).send({ error: 'Unauthorized' });
    }
  });
}
