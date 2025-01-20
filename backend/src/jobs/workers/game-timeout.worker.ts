import { Worker } from "bullmq";
import { config } from "../../config/config";
import { DataSource } from "typeorm";
import { Room } from "../../entities/Room";
import { NotFoundError } from "../../errors/api";
import { Server } from "socket.io";

export const createGameTimeoutWorker = (dataSource: DataSource, io: Server) => {
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
      }
    },
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
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
