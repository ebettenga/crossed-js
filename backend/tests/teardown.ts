import { redisService } from "../src/services/RedisService";
import {
  emailQueue,
  gameInactivityQueue,
  gameTimeoutQueue,
  statusCleanupQueue,
} from "../src/jobs/queues";

export default async function globalTeardown() {
  try {
    // Close all Redis connections
    await redisService.close();

    // Close all BullMQ queues
    await emailQueue.close();
    await statusCleanupQueue.close();
    await gameTimeoutQueue.close();
    await gameInactivityQueue.close();
  } catch (error) {
    console.error("Error in global teardown:", error);
  }
}
