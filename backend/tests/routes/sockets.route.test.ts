import Fastify, { type FastifyInstance } from "fastify";
import fastifyIO from "fastify-socket.io";
import { io as createClient, type Socket } from "socket.io-client";
import { AddressInfo } from "net";
import jwt from "jsonwebtoken";
import { DataSource } from "typeorm";
import type { PluginDataSource } from "typeorm-fastify-plugin";

import socketsRoutes from "../../src/routes/private/sockets";
import { User } from "../../src/entities/User";
import { Room } from "../../src/entities/Room";
import { Crossword } from "../../src/entities/Crossword";
import { GameStats } from "../../src/entities/GameStats";
import { config } from "../../src/config/config";
import { redisService } from "../../src/services/RedisService";
import {
  emailQueue,
  gameInactivityQueue,
  gameTimeoutQueue,
  statusCleanupQueue,
} from "../../src/jobs/queues";
import { createPostgresTestManager } from "../utils/postgres";
import { createRedisTestManager } from "../utils/redis";

jest.mock("../../src/services/EmailService", () => ({
  __esModule: true,
  emailService: {
    sendEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  },
}));

jest.setTimeout(60000);

const postgres = createPostgresTestManager({
  label: "Sockets route tests",
  entities: [User, Room, Crossword, GameStats],
  env: {
    database: [
      "SOCKETS_ROUTE_TEST_DB",
      "ROOM_SERVICE_TEST_DB",
      "POSTGRES_DB",
    ],
    schema: [
      "SOCKETS_ROUTE_TEST_SCHEMA",
      "ROOM_SERVICE_TEST_SCHEMA",
    ],
    host: [
      "SOCKETS_ROUTE_TEST_DB_HOST",
      "ROOM_SERVICE_TEST_DB_HOST",
      "PGHOST",
    ],
    port: [
      "SOCKETS_ROUTE_TEST_DB_PORT",
      "ROOM_SERVICE_TEST_DB_PORT",
      "PGPORT",
    ],
    username: [
      "SOCKETS_ROUTE_TEST_DB_USER",
      "ROOM_SERVICE_TEST_DB_USER",
      "PGUSER",
    ],
    password: [
      "SOCKETS_ROUTE_TEST_DB_PASSWORD",
      "ROOM_SERVICE_TEST_DB_PASSWORD",
      "PGPASSWORD",
    ],
  },
  defaults: {
    database: "crossed_test",
    schema: "sockets_route_test",
    host: "127.0.0.1",
    port: 5432,
    username: "postgres",
    password: "postgres",
  },
});

const redisManager = createRedisTestManager({
  url: config.redis.default,
  label: "Sockets route tests Redis",
});

let dataSource: DataSource;
let app: FastifyInstance;
let serverUrl: string;
const activeClients: Socket[] = [];

const TABLES_TO_TRUNCATE = [
  "game_stats",
  "room_players",
  "room",
  "crossword",
  "user",
];

const waitFor = async <T>(
  action: () => Promise<T>,
  timeout = 5000,
  interval = 25,
): Promise<T> => {
  const started = Date.now();
  let lastError: unknown;

  while (Date.now() - started <= timeout) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Timed out waiting for condition");
};

const createUser = async (overrides: Partial<User> = {}) => {
  const repository = dataSource.getRepository(User);
  const user = repository.create({
    username: `socket-user-${Math.random().toString(36).slice(2, 8)}`,
    email: `${Date.now()}-${Math.random()}@example.com`,
    password: "password",
    status: "offline",
    roles: ["user"],
    eloRating: 1200,
    ...overrides,
  });
  return repository.save(user);
};

const createCrossword = async (overrides: Partial<Crossword> = {}) => {
  const repository = dataSource.getRepository(Crossword);
  const crossword = repository.create({
    clues: { across: ["A clue"], down: ["Down clue"] },
    answers: { across: ["A"], down: ["D"] },
    author: "Test Author",
    created_by: "Tester",
    creator_link: "https://example.com",
    circles: [],
    date: new Date("2024-01-01T00:00:00.000Z"),
    dow: "Monday",
    grid: ["A", "B", "C", "D"],
    gridnums: ["1", "2", "3", "4"],
    shadecircles: false,
    col_size: 2,
    row_size: 2,
    jnote: "Test note",
    notepad: "Test notepad",
    title: "Socket Test Crossword",
    ...overrides,
  });
  return repository.save(crossword);
};

const createRoomForUser = async (
  user: User,
  overrides: Partial<Room> = {},
) => {
  const repository = dataSource.getRepository(Room);
  const crossword = overrides.crossword ?? await createCrossword();
  const room = repository.create({
    type: "1v1",
    status: "pending",
    difficulty: "easy",
    players: [user],
    crossword,
    scores: { [user.id]: 0 },
    found_letters: [],
    ...overrides,
  });
  const saved = await repository.save(room);
  return repository.findOneOrFail({ where: { id: saved.id } });
};

const buildAuthToken = (user: User) =>
  jwt.sign(
    { sub: user.id, roles: user.roles },
    config.auth.secretAccessToken,
    { expiresIn: "1h" },
  );

const connectClient = async (user: User) => {
  const token = buildAuthToken(user);
  const client = createClient(serverUrl, {
    auth: { authToken: token },
    transports: ["websocket"],
    forceNew: true,
  });

  activeClients.push(client);

  await new Promise<void>((resolve, reject) => {
    client.once("connect", () => resolve());
    client.once("connect_error", (error) => reject(error));
  });

  await waitFor(async () => {
    const stored = await dataSource.getRepository(User).findOneByOrFail({
      id: user.id,
    });
    if (stored.status !== "online") {
      throw new Error("User not online yet");
    }
    return stored;
  });

  await waitFor(async () => {
    const isRegistered = await redisService.isUserOnThisServer(user.id);
    if (!isRegistered) {
      throw new Error("User not registered on this server");
    }
    return true;
  });

  return client;
};

const disconnectClient = async (client: Socket) => {
  if (!client.connected) {
    const index = activeClients.indexOf(client);
    if (index !== -1) {
      activeClients.splice(index, 1);
    }
    return;
  }

  await new Promise<void>((resolve) => {
    client.once("disconnect", () => resolve());
    client.disconnect();
  });

  const index = activeClients.indexOf(client);
  if (index !== -1) {
    activeClients.splice(index, 1);
  }
};

beforeAll(async () => {
  await postgres.setup();
  dataSource = postgres.dataSource;

  await redisManager.setup();
  await redisManager.flush();

  app = Fastify({ logger: false });
  await app.register(fastifyIO, { cors: config.cors });
  app.decorate("orm", dataSource as unknown as PluginDataSource);

  socketsRoutes(app as any, {}, () => {});
  await app.ready();

  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address() as AddressInfo;
  serverUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  await postgres.truncate(TABLES_TO_TRUNCATE);
  await redisManager.flush();
});

afterEach(async () => {
  while (activeClients.length > 0) {
    const client = activeClients.pop();
    if (client) {
      await disconnectClient(client);
    }
  }
});

afterAll(async () => {
  await app.close();
  try {
    await redisManager.flush();
  } catch {
    // ignore cleanup errors
  }
  await redisManager.close();
  await Promise.allSettled([
    emailQueue.close(),
    statusCleanupQueue.close(),
    gameTimeoutQueue.close(),
    gameInactivityQueue.close(),
  ]);
  await redisService.close();
  const { fastify: globalFastify } = await import("../../src/fastify");
  await globalFastify.close();
  await postgres.close();
});

describe("sockets routes", () => {
  it("registers user presence on connect and cleans up on disconnect", async () => {
    const user = await createUser();
    const room = await createRoomForUser(user);

    const token = buildAuthToken(user);
    const client = createClient(serverUrl, {
      auth: { authToken: token },
      transports: ["websocket"],
      forceNew: true,
    });
    activeClients.push(client);

    const connectionMessage = new Promise<{ data: string }>((resolve) => {
      client.once("connection", (payload) => resolve(payload));
    });

    await new Promise<void>((resolve, reject) => {
      client.once("connect", () => resolve());
      client.once("connect_error", (error) => reject(error));
    });

    const payload = await connectionMessage;
    expect(payload.data).toContain("connected");

    await waitFor(async () => {
      const stored = await dataSource.getRepository(User).findOneByOrFail({
        id: user.id,
      });
      if (stored.status !== "online") {
        throw new Error("User not online yet");
      }
      return stored;
    });

    await waitFor(async () => {
      const isRegistered = await redisService.isUserOnThisServer(user.id);
      if (!isRegistered) {
        throw new Error("User not registered on this server");
      }
      return true;
    });

    const serverSocket = await waitFor(async () => {
      const s = app.io.of("/").sockets.get(client.id);
      if (!s) {
        throw new Error("Socket not registered on server");
      }
      if (!s.rooms.has(room.id.toString())) {
        throw new Error("Room join not complete");
      }
      if (!s.rooms.has(`user_${user.id}`)) {
        throw new Error("User room join not complete");
      }
      return s;
    });

    expect(serverSocket.rooms.has(room.id.toString())).toBe(true);
    expect(serverSocket.rooms.has(`user_${user.id}`)).toBe(true);

    await disconnectClient(client);

    await waitFor(async () => {
      const stored = await dataSource.getRepository(User).findOneByOrFail({
        id: user.id,
      });
      if (stored.status !== "offline") {
        throw new Error("User not offline yet");
      }
      return stored;
    });

    await waitFor(async () => {
      const userServer = await redisService.getUserServer(user.id);
      if (userServer !== null) {
        throw new Error("User presence still registered");
      }
      return true;
    });
  });

  it("joins a room via join_room_bus and broadcasts the room state", async () => {
    const user = await createUser();
    const room = await createRoomForUser(user);
    const client = await connectClient(user);

    const roomEvent = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Timed out waiting for room event")),
        5000,
      );
      client.once("room", (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });

    client.emit("join_room_bus", { roomId: room.id, message: "load" });

    const broadcast = await roomEvent;
    expect(broadcast.id).toBe(room.id);
    expect(Array.isArray(broadcast.players)).toBe(true);
    expect(broadcast.players.some((player: any) => player.id === user.id)).toBe(
      true,
    );

    await disconnectClient(client);
  });

  it("relays room_cancelled events published through Redis", async () => {
    const user = await createUser();
    const room = await createRoomForUser(user);
    const client = await connectClient(user);

    const cancellationEvent = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Timed out waiting for cancellation event")),
        5000,
      );
      client.once("room_cancelled", (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });

    const message = {
      type: "room_cancelled",
      data: {
        roomId: room.id,
        message: "Room cancelled by host",
        reason: "host_left",
        players: [user.id],
      },
    };

    await redisService.publish("game_events", JSON.stringify(message));

    const payload = await cancellationEvent;
    expect(payload.roomId).toBe(room.id);
    expect(payload.reason).toBe("host_left");
    expect(payload.message).toBe("Room cancelled by host");

    await disconnectClient(client);
  });
});
