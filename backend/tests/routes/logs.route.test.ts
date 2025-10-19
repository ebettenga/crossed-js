import Fastify from "fastify";
import { DataSource } from "typeorm";
import type { PluginDataSource } from "typeorm-fastify-plugin";
import { ensureApprovedSnapshot } from "../utils/approval";
import { createPostgresTestManager } from "../utils/postgres";
import { Crossword } from "../../src/entities/Crossword";
import { GameStats } from "../../src/entities/GameStats";
import { Log } from "../../src/entities/Log";
import { Room } from "../../src/entities/Room";
import { User } from "../../src/entities/User";
import logsRoutes from "../../src/routes/private/logs";

jest.setTimeout(60000);

const postgres = createPostgresTestManager({
  label: "Logs route tests",
  entities: [Crossword, GameStats, Log, Room, User],
  env: {
    database: [
      "LOGS_ROUTE_TEST_DB",
      "ROOM_SERVICE_TEST_DB",
      "POSTGRES_DB",
    ],
    schema: [
      "LOGS_ROUTE_TEST_SCHEMA",
      "ROOM_SERVICE_TEST_SCHEMA",
    ],
    host: [
      "LOGS_ROUTE_TEST_DB_HOST",
      "ROOM_SERVICE_TEST_DB_HOST",
      "PGHOST",
    ],
    port: [
      "LOGS_ROUTE_TEST_DB_PORT",
      "ROOM_SERVICE_TEST_DB_PORT",
      "PGPORT",
    ],
    username: [
      "LOGS_ROUTE_TEST_DB_USER",
      "ROOM_SERVICE_TEST_DB_USER",
      "PGUSER",
    ],
    password: [
      "LOGS_ROUTE_TEST_DB_PASSWORD",
      "ROOM_SERVICE_TEST_DB_PASSWORD",
      "PGPASSWORD",
    ],
  },
  defaults: {
    database: "crossed_test",
    schema: "logs_route_test",
    host: "127.0.0.1",
    port: 5432,
    username: "postgres",
    password: "postgres",
  },
});

let dataSource: DataSource;
const LOG_TABLES = ["log"];

const buildServer = async (user: User) => {
  const app = Fastify({ logger: false });

  // Match the plugin typing without booting the full Fastify plugin in tests
  app.decorate("orm", dataSource as unknown as PluginDataSource);
  app.decorateRequest("user", null);
  app.addHook("preHandler", (request, _reply, done) => {
    request.user = user;
    done();
  });

  logsRoutes(app as any, {}, () => {});
  await app.ready();
  return app;
};

const createUser = (overrides: Partial<User> = {}) =>
  Object.assign(new User(), {
    id: 101,
    username: "tester",
    email: "tester@example.com",
    password: "secret",
    roles: ["user"],
    status: "online",
    eloRating: 1200,
    ...overrides,
  });

const createLogEntry = async (
  attributes: Partial<Log> & { severity: string; log: object },
) => {
  const repository = dataSource.getRepository(Log);
  const entry = repository.create({
    created_at: new Date("2024-01-01T00:00:00.000Z"),
    ...attributes,
  });
  return repository.save(entry);
};

beforeAll(async () => {
  await postgres.setup();
  dataSource = postgres.dataSource;
  await postgres.truncate(LOG_TABLES);
});

beforeEach(async () => {
  await postgres.truncate(LOG_TABLES);
});

afterAll(async () => {
  await postgres.close();
});

describe("logs routes", () => {
  it("returns persisted logs matching the snapshot", async () => {
    const user = createUser();
    await createLogEntry({
      severity: "info",
      log: { message: "First entry", userId: 10 },
      created_at: new Date("2024-01-01T00:00:00.000Z"),
    });
    await createLogEntry({
      severity: "error",
      log: { message: "Second entry", userId: 11 },
      created_at: new Date("2024-01-02T00:00:00.000Z"),
    });

    const app = await buildServer(user);
    const response = await app.inject({
      method: "GET",
      url: "/logs",
    });
    expect(response.statusCode).toBe(200);

    const payload = response.json() as Array<{
      id: number;
      created_at: string;
      severity: string;
      log: object;
    }>;

    const sanitized = payload.map((entry) => ({
      id: entry.id,
      created_at: entry.created_at,
      severity: entry.severity,
      log: entry.log,
    }));

    await ensureApprovedSnapshot({
      testFile: expect.getState().testPath ?? "logs.route.test.ts",
      snapshotName: "returns persisted logs matching the snapshot",
      received: sanitized,
    });

    await app.close();
  });

  it("creates a log record and overrides body userId with authenticated user", async () => {
    const user = createUser({ id: 202 });
    const app = await buildServer(user);

    const body = {
      severity: "warn",
      log: { message: "Example log from client", userId: 999 },
    };

    const response = await app.inject({
      method: "POST",
      url: "/logs",
      payload: body,
    });

    expect(response.statusCode).toBe(201);
    const payload = response.json();

    expect(payload.log.userId).toBe(user.id);
    expect(payload.severity).toBe(body.severity);
    expect(payload.id).toBeGreaterThan(0);

    const repository = dataSource.getRepository(Log);
    const stored = await repository.findOneByOrFail({ id: payload.id });

    expect(stored.log).toEqual({
      message: body.log.message,
      userId: user.id,
    });
    expect(stored.severity).toBe(body.severity);

    await app.close();
  });

  it("rejects log creation when severity is missing", async () => {
    const user = createUser();
    const app = await buildServer(user);

    const response = await app.inject({
      method: "POST",
      url: "/logs",
      payload: { log: { message: "No severity" } },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);

    await app.close();
  });
});
