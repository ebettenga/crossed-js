import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "../config/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { findDir } from "./findConfigDir";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const loadTestData = async () => {
  const AppDataSource = new DataSource(config.db);
  const connection = await AppDataSource.initialize();
  await connection.synchronize();

  const dirname = path.resolve(__dirname, "../../");
  const testDataDir = findDir(dirname, "test-data");
  if (!testDataDir) {
    throw new Error("Test data directory not found");
  }

  const files = fs.readdirSync(testDataDir);

  for (const file of files) {
    const { create } = await import(path.join(testDataDir, file));
    await create(connection);
  }

  await connection.destroy();
};
