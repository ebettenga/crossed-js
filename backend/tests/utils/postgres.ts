import { DataSource } from "typeorm";
import type { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

/**
 * Helper utilities for spinning up isolated Postgres schemas per integration test suite.
 * Usage:
 *   const postgres = createPostgresTestManager({ label, entities, ...env config });
 *   await postgres.setup();
 *   const dataSource = postgres.dataSource;
 *   await postgres.truncate(["table_a", "table_b"]);
 *   await postgres.close();
 */

type EnvKeyList = string[];

type EnvConfig = {
  database?: EnvKeyList;
  schema?: EnvKeyList;
  host?: EnvKeyList;
  port?: EnvKeyList;
  username?: EnvKeyList;
  password?: EnvKeyList;
};

type DefaultConfig = {
  database?: string;
  schema?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
};

export type PostgresTestManagerOptions = {
  label: string;
  entities: PostgresConnectionOptions["entities"];
  env?: EnvConfig;
  defaults?: DefaultConfig;
  synchronize?: boolean;
};

const resolveEnv = (
  keys: EnvKeyList | undefined,
  fallback: string | undefined,
): string | undefined => {
  if (keys) {
    for (const key of keys) {
      const value = process.env[key];
      if (value && value.trim().length > 0) {
        return value.trim();
      }
    }
  }
  return fallback;
};

export class PostgresTestManager {
  readonly label: string;
  readonly schema: string;
  private dataSourceInstance: DataSource | null = null;
  private readonly options: PostgresConnectionOptions;

  constructor({
    label,
    entities,
    env,
    defaults,
    synchronize = true,
  }: PostgresTestManagerOptions) {
    this.label = label;

    const database = resolveEnv(env?.database, defaults?.database) ||
      "crossed_test";
    const schema = resolveEnv(env?.schema, defaults?.schema) ||
      `${label.replace(/\s+/g, "_").toLowerCase()}_test`;
    const host = resolveEnv(env?.host, defaults?.host) || "127.0.0.1";
    const portRaw = resolveEnv(
      env?.port,
      defaults?.port !== undefined ? String(defaults.port) : undefined,
    );
    const username = resolveEnv(env?.username, defaults?.username) ||
      "postgres";
    const password = resolveEnv(env?.password, defaults?.password) ||
      "postgres";
    const port = portRaw ? parseInt(portRaw, 10) : 5432;

    if (!Number.isFinite(port)) {
      throw new Error(
        `${label}: Invalid Postgres port "${
          portRaw ?? ""
        }". Provide a numeric value.`,
      );
    }

    if (!/_test$/i.test(database)) {
      throw new Error(
        `${label}: Test database must end with "_test" (received "${database}").`,
      );
    }

    this.schema = schema;
    const connectionOptions = {
      type: "postgres",
      host,
      port,
      username,
      password,
      database,
      schema,
      synchronize,
      entities,
    } satisfies PostgresConnectionOptions;

    this.options = connectionOptions;
  }

  get dataSource(): DataSource {
    if (!this.dataSourceInstance) {
      throw new Error(
        `${this.label}: DataSource accessed before setup. Call setup() first.`,
      );
    }
    return this.dataSourceInstance;
  }

  async setup(): Promise<void> {
    if (this.dataSourceInstance?.isInitialized) {
      return;
    }

    const { schema: _schema, ...adminBase } = this.options;
    const adminOptions = {
      ...adminBase,
      synchronize: false,
      entities: [],
    } satisfies PostgresConnectionOptions;
    const admin = new DataSource(adminOptions);

    await admin.initialize();
    await admin.query(`CREATE SCHEMA IF NOT EXISTS "${this.schema}"`);
    await admin.destroy();

    this.dataSourceInstance = new DataSource({
      ...this.options,
      schema: this.schema,
    });
    await this.dataSourceInstance.initialize();
  }

  async truncate(
    tables: string[],
    {
      restartIdentity = true,
      cascade = true,
    }: { restartIdentity?: boolean; cascade?: boolean } = {},
  ): Promise<void> {
    if (tables.length === 0) {
      return;
    }
    const clauses = [
      restartIdentity ? "RESTART IDENTITY" : "",
      cascade ? "CASCADE" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const qualifiedTables = tables.map((table) => this.qualified(table));
    const sql = `TRUNCATE TABLE ${qualifiedTables.join(", ")}${
      clauses ? ` ${clauses}` : ""
    }`;
    await this.dataSource.query(sql);
  }

  qualified(table: string): string {
    return `"${this.schema}"."${table}"`;
  }

  async close(): Promise<void> {
    if (this.dataSourceInstance?.isInitialized) {
      await this.dataSourceInstance.destroy();
    }
    this.dataSourceInstance = null;
  }
}

export const createPostgresTestManager = (
  options: PostgresTestManagerOptions,
): PostgresTestManager => new PostgresTestManager(options);
