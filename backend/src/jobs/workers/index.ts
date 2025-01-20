import { DataSource } from 'typeorm';
import { createEmailWorker } from './email.worker';
import { createStatusCleanupWorker } from './status-cleanup.worker';

let workers: any[] = [];

export const initializeWorkers = (dataSource: DataSource) => {
  const emailWorker = createEmailWorker();
  const statusCleanupWorker = createStatusCleanupWorker(dataSource);

  workers = [emailWorker, statusCleanupWorker];
  return workers;
};

// Graceful shutdown function
export async function closeWorkers() {
  await Promise.all(workers.map((worker) => worker.close()));
}
