import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

export const config = {
  logger: {
    levels: {
      fatal: 0,
      error: 1,
      warn: 2,
      info: 3,
      trace: 4,
      debug: 5,
    },
    level: 'info',
  },
  db: {
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
    database: 'application',
    synchronize: true,
    logging: false,
    entities: ['./src/entities/**/*.ts'],
    migrations: ['./src/migrations/**/*.ts'],
    subscribers: ['./src/subscribers/**/*.ts'],
  } as PostgresConnectionOptions,
  github: {
    clientId: 'Ov23liJAlQZgHCZ4JvUk',
    clientSecret: '45177a38fd0112b9799da692e5a9d8caa97ed42c',
  },
  secretKeyPath: './config/secret-key',
};
