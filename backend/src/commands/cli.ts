#!/usr/bin/env node

import { program } from 'commander';
import { loadTestData } from '../scripts/loadTestData';
import { CrosswordService } from '../services/CrosswordService';
import { AppDataSource } from '../db';
import { gameInactivityQueue } from '../jobs/queues';
import { v4 as uuidv4 } from 'uuid';

program
  .command('load-crosswords')
  .description('Load crosswords into the database')
  .action(async (dir) => {
    try {
      const dataSource = await AppDataSource.initialize()
      await new CrosswordService(dataSource).loadCrosswords();
      console.log('Crosswords loaded successfully');
    } catch (error) {
      console.error('Error loading crosswords:', error);
    }
  });

program
  .command('load-test-data')
  .description('Load test data into the database')
  .action(async () => {
    try {
      await loadTestData();
      console.log('Test data loaded successfully');
    } catch (error) {
      console.error('Error loading test data:', error);
    }
  });

program
  .command('add-inactivity-check')
  .description('Add an inactivity check job for a room')
  .requiredOption('-r, --roomId <number>', 'Room ID to check')
  .option('-d, --delay <number>', 'Delay in milliseconds before the check (default: 10000)', '10000')
  .action(async (options) => {
    try {
      const { roomId, delay } = options;
      const now = Date.now();

      console.log(`Adding inactivity check for room ${roomId} with delay ${delay}ms`);

      const job = await gameInactivityQueue.add(
        "game-inactivity",
        {
          roomId: parseInt(roomId),
          lastActivityTimestamp: now
        },
        {
          jobId: `game-inactivity-${roomId}-${uuidv4()}`,
          delay: parseInt(delay),
          removeOnComplete: { count: 1 },
          removeOnFail: { count: 1 }
        }
      );

      console.log('Successfully added inactivity check:', {
        jobId: job.id,
        roomId: roomId,
        scheduledFor: new Date(now + parseInt(delay)).toISOString(),
        delay: parseInt(delay)
      });

      process.exit(0);
    } catch (error) {
      console.error('Error adding inactivity check:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);
