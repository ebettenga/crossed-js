import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions.js";

export const config = {
  logger: {
    transport: {
      target: "pino-pretty",
      options: {},
    },
  },
  db: {
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "postgres",
    password: "postgres",
    database: "crossed",
    synchronize: false,
    logging: false,
    entities: ["./src/entities/**/*.ts", "./"],
    migrations: ["./src/migrations/**/*.ts"],
    subscribers: ["./src/subscribers/**/*.ts"],
  } as PostgresConnectionOptions,
  auth: {
    secretAccessToken: "aklwj*$%rngbak4a43",
    authRefreshTokenExpiry: "3w",
    authTokenExpiry: "1h",
  },
  secretKeyPath: "./config/secret-key",
};
