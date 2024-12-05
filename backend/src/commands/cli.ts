#!/usr/bin/env node

import { program } from 'commander';
// import { loadCrosswords } from './crosswords';

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

program.parse(process.argv);