import { Queue } from "bullmq";
import { config } from "../config/config";

// Define your job types here
export interface EmailJobData {
  to: string;
  subject: string;
  body: string;
}

export interface GameTimeoutJobData {
  roomId: number;
}

export interface GameAutoRevealJobData {
  roomId: number;
  lastActivityTimestamp?: number;
}

// Create and export queues
export const emailQueue = new Queue<EmailJobData>("email", {
  connection: config.redis.default,
});

export const statusCleanupQueue = new Queue("status-cleanup", {
  connection: config.redis.default,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 1000,
  },
});

export const gameTimeoutQueue = new Queue<GameTimeoutJobData>("game-timeout", {
  connection: config.redis.default,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 1000,
  },
});

export const gameAutoRevealQueue = new Queue<GameAutoRevealJobData>(
  "game-auto-reveal",
  {
    connection: config.redis.default,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: 1000,
    },
  },
);

// Add initial repeatable job
statusCleanupQueue.upsertJobScheduler(
  "status-cleanup",
  {
    every: config.status.cleanup.interval,
  },
  {
    name: "status-cleanup",
    data: {},
    opts: {}, // Optional additional job options
  },
);

// Add more queues as needed
