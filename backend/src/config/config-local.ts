import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

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
    database: "application",
    synchronize: true,
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
    secretAccessToken: "aklwj*$%rngbak4a43",
    authRefreshTokenExpiry: "3w",
    authTokenExpiry: "2h",
  },
  secretKeyPath: "./config/secret-key",
};
