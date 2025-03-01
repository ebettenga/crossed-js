import { Worker } from 'bullmq';
import { config } from '../../config/config';
import { EmailJobData } from '../queues';
import { emailService } from '../../services/EmailService';

export const createEmailWorker = () => {
  const worker = new Worker<EmailJobData>(
    'email',
    async (job) => {
      console.log('Processing email job:', job.data);
      const { to, subject, body } = job.data;
      await emailService.sendEmail(to, subject, body);
      console.log('Email sent successfully');
    },
    {
      connection: config.redis.default,
      concurrency: 5, // Process 5 emails at a time
    }
  );

  worker.on('completed', (job) => {
    console.log(`Email job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Email job ${job?.id} failed:`, err);
  });

  return worker;
};
