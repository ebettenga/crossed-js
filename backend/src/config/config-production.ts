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
    port: 5432,
    username: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.POSTGRES_DB,
    synchronize: false,
    logging: false,
    entities: ["./src/entities/**/*.ts"],
  } as PostgresConnectionOptions,
  auth: {
    secretAccessToken: process.env.SECRET_ACCESS_TOKEN!,
    authRefreshTokenExpiry: "3w",
    authTokenExpiry: "2h",
  },
  secretKeyPath: process.env.SECRET_KEY_PATH!,
};
