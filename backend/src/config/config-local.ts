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
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT),
    username: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.POSTGRES_DB,
    synchronize: false,
    logging: false,
    entities: ["./src/entities/**/*.ts"],
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
