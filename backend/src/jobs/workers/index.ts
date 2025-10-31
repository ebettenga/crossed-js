import { DataSource } from 'typeorm';
import { createEmailWorker } from './email.worker';
import { createStatusCleanupWorker } from './status-cleanup.worker';
import { createGameTimeoutWorker } from './game-timeout.worker';
import { createGameAutoRevealWorker } from './game-auto-reveal.worker';
import { FastifyInstance } from 'fastify';

let workers: any[] = [];

export const initializeWorkers = (dataSource: DataSource, fastify: FastifyInstance) => {
  const emailWorker = createEmailWorker();
  const statusCleanupWorker = createStatusCleanupWorker(dataSource);
  const gameTimeoutWorker = createGameTimeoutWorker(dataSource, fastify);
  const gameAutoRevealWorker = createGameAutoRevealWorker(dataSource, fastify);

  workers = [emailWorker, statusCleanupWorker, gameTimeoutWorker, gameAutoRevealWorker];
  return workers;
};

// Graceful shutdown function
export async function closeWorkers() {
  await Promise.all(workers.map((worker) => worker.close()));
}
