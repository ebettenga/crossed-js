import { Queue } from 'bullmq';
import { config } from '../config/config';

// Define your job types here
export interface EmailJobData {
  to: string;
  subject: string;
  body: string;
}

// Create and export queues
export const emailQueue = new Queue<EmailJobData>('email', {
  connection: config.redis,
});

// Add more queues as needed
