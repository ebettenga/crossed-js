import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { userPassport } from '../auth'

export default function (fastify: FastifyInstance, _: object, next: (err?: Error) => void): void {
    fastify.get(
        "/users",
        { preValidation: userPassport.authenticate('github') },
        async () => { return { hello: 'world' } }
      )

  next()
}

