import { Worker } from 'bullmq';
import { config } from '../config/config';
import { EmailJobData } from './queues';

// Email worker
const emailWorker = new Worker<EmailJobData>(
  'email',
  async (job) => {
    // Process email job
    console.log('Processing email job:', job.data);
    // Add your email sending logic here
  },
  {
    connection: config.redis,
  }
);

emailWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

// Export workers for cleanup
export const workers = [emailWorker];

// Graceful shutdown function
export async function closeWorkers() {
  await Promise.all(workers.map((worker) => worker.close()));
}
