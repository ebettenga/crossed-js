import { Worker } from 'bullmq';
import { config } from '../config/config';
import { EmailJobData } from './queues';
import { emailService } from '../services/EmailService';

// Email worker
const emailWorker = new Worker<EmailJobData>(
  'email',
  async (job) => {
    console.log('Processing email job:', job.data);
    const { to, subject, body } = job.data;
    await emailService.sendEmail(to, subject, body);
    console.log('Email sent successfully');
  },
  {
    connection: config.redis,
    concurrency: 5, // Process 5 emails at a time
  }
);

emailWorker.on('completed', (job) => {
  console.log(`Email job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`Email job ${job?.id} failed:`, err);
});

// Export workers for cleanup
export const workers = [emailWorker];

// Graceful shutdown function
export async function closeWorkers() {
  await Promise.all(workers.map((worker) => worker.close()));
}
