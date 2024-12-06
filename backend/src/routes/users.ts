import { FastifyInstance } from 'fastify';
import { User } from '../entities/User';

// wip
export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  fastify.get(
    '/users',
    {
      // preValidation: [fastify.basicAuth],
    },
    async () => {
      fastify.log.info('Getting all users');
      const users = await fastify.orm.getRepository(User).find();
      return users.map((user) => {
        const { githubId, ...rest } = user;
        return rest;
      });
    },
  );

  next();
}
