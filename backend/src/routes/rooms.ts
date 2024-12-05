import { FastifyInstance } from 'fastify';
import { RoomService } from '../services/RoomService';

type Coordinates = {
    x: number;
    y: number;
}

type RoomQueryParams = {
  roomId: number;
  coordinates: Coordinates;
  guess: string;
  userId: number;
  difficulty?: string;
};

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  const roomService = new RoomService(fastify.orm);

  fastify.get('/rooms/:roomId', async (request, reply) => {
    const params = request.params as { roomId: string };
    const room = await roomService.getRoomById(parseInt(params.roomId));
    reply.send(room);
  });

  fastify.post('/rooms/join', async (request, reply) => {
    const { userId, difficulty } = request.body as RoomQueryParams;
    const room = await roomService.joinRoom(userId, difficulty);
    reply.send(room);
  });

  fastify.post('/rooms/guess', async (request, reply) => {
    const { roomId, coordinates, guess, userId } =
      request.body as RoomQueryParams;
    const room = await roomService.guess(roomId, coordinates, guess, userId);
    reply.send(room);
  });

  next();
}
