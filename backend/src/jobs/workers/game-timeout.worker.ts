import { Worker } from "bullmq";
import { config } from "../../config/config";
import { DataSource } from "typeorm";
import { Room } from "../../entities/Room";
import { NotFoundError } from "../../errors/api";
import { Server } from "socket.io";
import { RedisService } from "../../services/RedisService";

export const createGameTimeoutWorker = (dataSource: DataSource, io: Server) => {
  // Ensure the dataSource is initialized
  const ensureConnection = async () => {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
  };

  const redisService = new RedisService(io);

  const worker = new Worker(
    "game-timeout",
    async (job) => {
      await ensureConnection();
      const roomRepository = dataSource.getRepository(Room);

      console.log(`Processing game timeout for room ${job.data.roomId}`);

      const room = await roomRepository.findOne({
        where: { id: job.data.roomId },
        relations: ["players"],
      });

      if (!room) {
        console.log(`Room ${job.data.roomId} not found`);
        throw new NotFoundError("Room not found");
      }

      console.log(`Found room ${room.id} with status ${room.status}`);

      // Only cancel if the room is still pending
      if (room.status === "pending") {
        console.log(`Cancelling room ${room.id}`);
        room.status = "cancelled";
        await roomRepository.save(room);

        // Use Redis to broadcast the room_cancelled event
        const eventData = {
          message: "Game was cancelled due to inactivity",
          roomId: room.id,
          reason: "timeout"
        };
        console.log(`Publishing room_cancelled event to Redis:`, eventData);

        try {
          // Send to each player's user-specific room
          for (const player of room.players) {
            console.log(`Publishing room_cancelled event to user ${player.id}`);
            await redisService.publishGameEvent(player.id, "room_cancelled", eventData);
          }
          console.log(`Successfully published room_cancelled event for room ${room.id}`);
        } catch (error) {
          console.error(`Failed to publish room_cancelled event:`, error);
        }
      } else {
        console.log(`Room ${room.id} is not in pending status, current status: ${room.status}`);
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
    console.log(`Game timeout job ${job.id} completed for room ${job.data.roomId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Game timeout job ${job?.id} failed:`, err);
  });

  return worker;
};
