import { getRepository } from 'typeorm';
import { Crossword } from '../entities/Crossword';
import { createConnection } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

export const loadCrosswords = async () => {
  const connection = await createConnection();
  const crosswordRepository = getRepository(Crossword);

  const tableExists = await connection.query(`SHOW TABLES LIKE 'crosswords'`);
  if (tableExists.length === 0) {
    console.log("The table 'crosswords' does not exist");
    return;
  }

  const count = await crosswordRepository.count();
  if (count > 0) {
    console.log('Crosswords already loaded');
    return;
  }

  const crosswordsDir = path.join(__dirname, '../../../crosswords');
  fs.readdir(crosswordsDir, async (err, files) => {
    if (err) {
      console.error('Could not list the directory.', err);
      return;
    }

    for (const file of files) {
      const filePath = path.join(crosswordsDir, file);
      fs.readFile(filePath, 'utf8', async (err, data) => {
        if (err) {
          console.error(`Could not read file ${filePath}`, err);
          return;
        }

        try {
          const jsonData = JSON.parse(data);
          const date = new Date(jsonData.date);
          delete jsonData.date;
          jsonData.col_size = jsonData.size.cols;
          jsonData.row_size = jsonData.size.rows;

          if (
            jsonData.shadecircles === 'true' ||
            jsonData.shadecircles === 'false'
          ) {
            jsonData.shadecircles = jsonData.shadecircles === 'true';
          }

          const crossword = crosswordRepository.create({ ...jsonData, date });
          await crosswordRepository.save(crossword);
        } catch (e) {
          console.error(`${filePath} could not be parsed using JSON`, e);
        }
      });
    }
  });
};

loadCrosswords().catch((error) => console.error(error));
