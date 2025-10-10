import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions.js";

export const config = {
  logger: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
    test: true,
  },
  db: {
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "test_user",
    password: "test_password",
    database: "test_db",
    synchronize: false,
    logging: false,
    entities: ["./src/entities/**/*.ts"],
    migrations: ["./src/migrations/**/*.ts"],
    subscribers: ["./src/subscribers/**/*.ts"],
  } as PostgresConnectionOptions,
  github: {
    clientId: "Ov23liJAlQZgHCZ4JvUk",
    clientSecret: "45177a38fd0112b9799da692e5a9d8caa97ed42c",
  },
  auth: {
    secretAccessToken: "aljksdghae4334nmb",
    authRefreshTokenExpiry: "7d",
    authTokenExpiry: "1h",
  },
  secretKeyPath: "./config/secret-key",
};
