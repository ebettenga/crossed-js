import { DataSource } from 'typeorm';
import { createEmailWorker } from './email.worker';
import { createStatusCleanupWorker } from './status-cleanup.worker';
import { createGameTimeoutWorker } from './game-timeout.worker';
import { createGameInactivityWorker } from './game-inactivity.worker';
import { FastifyInstance } from 'fastify';

let workers: any[] = [];

export const initializeWorkers = (dataSource: DataSource, fastify: FastifyInstance) => {
  const emailWorker = createEmailWorker();
  const statusCleanupWorker = createStatusCleanupWorker(dataSource);
  const gameTimeoutWorker = createGameTimeoutWorker(dataSource, fastify);
  const gameInactivityWorker = createGameInactivityWorker(dataSource, fastify);

  workers = [emailWorker, statusCleanupWorker, gameTimeoutWorker, gameInactivityWorker];
  return workers;
};

// Graceful shutdown function
export async function closeWorkers() {
  await Promise.all(workers.map((worker) => worker.close()));
}
