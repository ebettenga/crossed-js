import { DataSource } from 'typeorm';
import { createEmailWorker } from './email.worker';
import { createStatusCleanupWorker } from './status-cleanup.worker';
import { createGameTimeoutWorker } from './game-timeout.worker';
import { Server } from 'socket.io';

let workers: any[] = [];

export const initializeWorkers = (dataSource: DataSource, io: Server) => {
  const emailWorker = createEmailWorker();
  const statusCleanupWorker = createStatusCleanupWorker(dataSource);
  const gameTimeoutWorker = createGameTimeoutWorker(dataSource, io);

  workers = [emailWorker, statusCleanupWorker, gameTimeoutWorker];
  return workers;
};

// Graceful shutdown function
export async function closeWorkers() {
  await Promise.all(workers.map((worker) => worker.close()));
}
