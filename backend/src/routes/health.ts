import { FastifyInstance } from 'fastify'

export default function (fastify: FastifyInstance, _: object, next: (err?: Error) => void): void {
    fastify.get(
        "/health",
        async () => { return { hello: 'world' } }
      )

  next()
}
