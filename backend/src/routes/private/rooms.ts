import { FastifyInstance } from "fastify";
import { RoomService } from "../../services/RoomService";
import { JoinRoom } from "./sockets";

type Coordinates = {
  x: number;
  y: number;
};

type RoomQueryParams = {
  coordinates: Coordinates;
  guess: string;
};

export default function (
  fastify: FastifyInstance,
  _: object,
  next: (err?: Error) => void,
): void {
  const roomService = new RoomService(fastify.orm);

  fastify.get("/rooms/:roomId", async (request, reply) => {
    const params = request.params as { roomId: string };
    const room = await roomService.getRoomById(parseInt(params.roomId));
    reply.send(room);
  });

  fastify.post("/rooms/join", async (request, reply) => {
    const { difficulty } = request.body as JoinRoom;
    const room = await roomService.joinRoom(request.user?.id, difficulty);
    fastify.io.sockets.socketsJoin(room.id.toString());
    fastify.io.to(room.id.toString()).emit("room", room);
    reply.send(room);
  });

  fastify.post("/rooms/:roomId", async (request, reply) => {
    const { coordinates, guess } = request
      .body as RoomQueryParams;
    const { roomId } = request.params as { roomId: number };
    const room = await roomService.guess(
      roomId,
      coordinates,
      guess,
      request.user.id,
    );
    reply.send(room);
  });

  next();
}
