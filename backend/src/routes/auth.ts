import { FastifyInstance } from 'fastify'
import { User } from '../entities/User';

export default function (fastify: FastifyInstance, _: object, next: (err?: Error) => void): void {
    fastify.get(
        "/auth/github/callback",
        async (request, response) => {
            fastify.logger.info("request", request);
            fastify.logger.info("response", response);
            fastify.logger.info("request", request);
            // fastify.logger.info("Profile: %o", profile);
            // try {
            //   const user = await fastify.orm
            //     .getRepository(User)
            //     .findOneBy({ githubId: profile.id });
      
            //   if (user) {
            //     return cb(null, user);
            //   }
      
            //   const newUser = new User();
            //   newUser.githubId = profile.id;
            //   newUser.username = profile.username;
            //   await fastify.orm.getRepository(User).save(newUser);
            //   return cb(null, newUser);
            // } catch (error) {
            //   return cb(error, null);
            // }
          }
      )

  next()
}
