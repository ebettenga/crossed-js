#!/usr/bin/env node

import { program } from 'commander';
import { loadTestData } from '../scripts/loadTestData';
import { CrosswordService } from '../services/CrosswordService';
import { AppDataSource } from '../db';



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

program.parse(process.argv);
