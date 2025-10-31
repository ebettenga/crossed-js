import { Worker } from "bullmq";
import { config } from "../../config/config";
import { DataSource } from "typeorm";
import { Room } from "../../entities/Room";
import { NotFoundError } from "../../errors/api";
import { createSocketEventService } from "../../services/SocketEventService";
import { FastifyInstance } from "fastify";

export const createGameTimeoutWorker = (
  dataSource: DataSource,
  fastify: FastifyInstance,
) => {
  const socketEventService = createSocketEventService(fastify);

  // Ensure the dataSource is initialized
  const ensureConnection = async () => {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
  };

  const worker = new Worker(
    "game-timeout",
    async (job) => {
      await ensureConnection();
      const roomRepository = dataSource.getRepository(Room);

      const room = await roomRepository.findOne({
        where: { id: job.data.roomId },
        relations: ["players"],
      });

      if (!room) {
        throw new NotFoundError("Room not found");
      }

      // Only cancel if the room is still pending
      if (room.status === "pending") {
        room.status = "cancelled";
        await roomRepository.save(room);

        // Notify all players in the room using the SocketEventService
        const timeoutPayload = {
          message: "We couldn't find another player in time.",
          roomId: room.id,
          reason: "pending_timeout",
        };

        await socketEventService.emitToRoom(
          room.id,
          "room_cancelled",
          timeoutPayload,
        );

        // Also notify each player individually to ensure they receive the message
        const playerIds = room.players.map((p) => p.id);
        await socketEventService.emitToUsers(
          playerIds,
          "room_cancelled",
          timeoutPayload,
        );
      }
    },
    {
      connection: config.redis.default,
    },
  );

  worker.on("completed", (job) => {
    console.log(`Game timeout job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Game timeout job ${job?.id} failed:`, err);
  });

  return worker;
};
