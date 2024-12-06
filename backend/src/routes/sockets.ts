import { FastifyInstance } from 'fastify';
import { RoomService } from '../services/RoomService'; // Assuming room_service is exported from RoomService

export type Guess = {
  room_id: number;
  x: number;
  y: number;
  guess: string;
  user_id: number;
};

export type JoinRoom = {
  user_id: number;
  difficulty: string;
};

export type Message = {
  message: string;
};

export type RoomMessage = {
  room_id: number;
} & Message;

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  const roomService = new RoomService(fastify.orm);
  // connection stuff
  fastify.io.on('connection', (socket) => {
    fastify.log.info('a user connected');
    // middleware to parse JSON payloads
    socket.use((packet, next) => {
      try {
        if (typeof packet[1] === 'string') {
          packet[1] = JSON.parse(packet[1]);
        }
      } catch (e) {
        fastify.log.error('Invalid JSON payload');
      }
      next();
    });
    socket.emit('connection', { data: `id: ${socket.id} is connected` });

    socket.on('disconnect', () => {
      fastify.log.info('user disconnected');
      socket.broadcast.emit('disconnection', `user ${socket.id} disconnected`);
    });


    // game stuff
    socket.on('join', async (data: JoinRoom) => {
      try {
        const room = await roomService.joinRoom(data.user_id, data.difficulty);
        socket.emit('room_joined', room);
        socket.join(room.id.toString());
      } catch (e) {
        socket.emit('error', e.messages);
      }
    });

    socket.on('loadRoom', async (room_id: number) => {
      const room = await roomService.getRoomById(room_id);
      socket.join(room.id.toString());
      socket.emit('room_joined', room);
    });

    socket.on('guess', async (data: Guess) => {
      try {
        const coordinates = { x: data.x, y: data.y };
        const room = await roomService.guess(
          data.room_id,
          coordinates,
          data.guess,
          data.user_id,
        );
        socket.to(room.id.toString()).emit('guess', { message: room });
      } catch (e) {
        socket.emit('error', e.messages);
      }
    });


    // chat stuff
    socket.on('message', (data: Message) => {
      socket.broadcast.emit('message', data);
      fastify.log.info(data);
    });

    socket.on('message_room', (data: RoomMessage) => {
      socket.broadcast
        .to(data.room_id.toString())
        .emit('message', data.message);
      fastify.log.info(data);
    });
  });

  next();
}