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
    host: process.env.PG_HOST,
    port: 5432,
    username: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_POSTGRES_DB,
    synchronize: true,
    logging: false,
    entities: ["./src/entities/**/*.ts"],
    migrations: ["./src/migrations/**/*.ts"],
    subscribers: ["./src/subscribers/**/*.ts"],
  } as PostgresConnectionOptions,
  auth: {
    secretAccessToken: process.env.SECRET_ACCESS_TOKEN,
    authRefreshTokenExpiry: "3w",
    authTokenExpiry: "2h",
  },
  secretKeyPath: process.env.SECRET_KEY,
};
