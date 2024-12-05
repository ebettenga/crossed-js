#!/usr/bin/env node

import { program } from 'commander';
import { loadTestData } from '../scripts/loadTestData';

program
  .command('load-crosswords')
  .argument('<dir>', 'Directory containing the crosswords')
  .description('Load crosswords into the database')
  .action(async (dir) => {
    console.log(`Directory: ${dir}`);
    try {
      // await loadCrosswords(dir);
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
