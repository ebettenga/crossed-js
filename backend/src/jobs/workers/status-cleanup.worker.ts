import { Worker } from 'bullmq';
import { config } from '../../config/config';
import { DataSource } from "typeorm";
import { User } from "../../entities/User";

export const createStatusCleanupWorker = (dataSource: DataSource) => {
  // Ensure the dataSource is initialized
  const ensureConnection = async () => {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
  };

  const worker = new Worker(
    "status-cleanup",
    async () => {
      await ensureConnection();
      const userRepository = dataSource.getRepository(User);

      // Find users who are marked as online but haven't had a heartbeat
      const staleUsers = await userRepository
        .createQueryBuilder("user")
        .where("user.status = :status", { status: "online" })
        .andWhere("user.updated_at < :threshold", {
          threshold: new Date(Date.now() - config.status.cleanup.heartbeatTimeout),
        })
        .getMany();

      if (staleUsers.length > 0) {
        console.log(`Found ${staleUsers.length} stale users to mark as offline`);
        // Update stale users to offline status
        await userRepository.update(
          staleUsers.map(user => user.id),
          { status: "offline" }
        );

        // Return status change events for each user
        return {
          usersUpdated: staleUsers.map(user => ({
            userId: user.id,
            status: 'offline' as const
          }))
        };
      }

      return { usersUpdated: [] };
    },
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`Status cleanup job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Status cleanup job ${job?.id} failed:`, err);
  });

  return worker;
};
