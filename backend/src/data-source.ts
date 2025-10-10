// src/data-source.ts
import "reflect-metadata";
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";

dotenv.config();

/*

This file is used for the migration command. it is not and should not be used in the app itself.

*/

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || "5432"),
  username: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.POSTGRES_DB,
  synchronize: false, // Set to false in production
  logging: true,
  entities: ["src/entities/**/*.ts"], // Path to your entity files
  migrations: ["src/migration/**/*.ts"], // Path to your migration files
  subscribers: [],
});
