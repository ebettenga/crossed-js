import { DataSource } from 'typeorm';
import { config } from '../config/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const AppDataSource = new DataSource(config.db);
const connection = await AppDataSource.initialize();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const loadTestData = async () => {
  await connection.synchronize();

  const dirname = path.resolve(__dirname, '../');
  const testDataDir = path.join(dirname, '/scripts/test-data');
  const files = fs.readdirSync(testDataDir);

  for (const file of files) {
    const { create } = await import(path.join(testDataDir, file));
    await create(connection);
  }

  await connection.close();
};
