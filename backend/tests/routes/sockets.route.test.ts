import Fastify, { type FastifyInstance } from "fastify";
import fastifyIO from "fastify-socket.io";
import { io as createClient, type Socket } from "socket.io-client";
import { AddressInfo } from "net";
import jwt from "jsonwebtoken";
import { DataSource } from "typeorm";
import type { PluginDataSource } from "typeorm-fastify-plugin";
import { Redis } from "ioredis";
import { createAdapter } from "@socket.io/redis-streams-adapter";

jest.mock("../../src/fastify", () => {
  const createFastify = require("fastify");
  return {
    fastify: createFastify({ logger: false }),
  };
});

import socketsRoutes from "../../src/routes/private/sockets";
import { User } from "../../src/entities/User";
import { Room } from "../../src/entities/Room";
import { Crossword } from "../../src/entities/Crossword";
import { GameStats } from "../../src/entities/GameStats";
import { UserCrosswordPack } from "../../src/entities/UserCrosswordPack";
import { config } from "../../src/config/config";
import { redisService } from "../../src/services/RedisService";
import { createSocketEventService } from "../../src/services/SocketEventService";
import { fastify as singletonFastify } from "../../src/fastify";
import {
  emailQueue,
  gameAutoRevealQueue,
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
  entities: [User, Room, Crossword, GameStats, UserCrosswordPack],
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
const additionalServers: FastifyInstance[] = [];
const adapterClients = new Map<FastifyInstance, Redis>();

// Mirrors the production setup in src/index.ts so instances share rooms and
// sessions through Redis
const registerSocketIO = async (target: FastifyInstance) => {
  const adapterRedis = new Redis(config.redis.default);
  adapterClients.set(target, adapterRedis);
  await target.register(fastifyIO, {
    cors: config.cors,
    adapter: createAdapter(adapterRedis),
    connectionStateRecovery: {
      maxDisconnectionDuration: config.socket.maxDisconnectionDuration,
      skipMiddlewares: true,
    },
  });
};

const closeServer = async (target: FastifyInstance) => {
  await target.close();
  const adapterRedis = adapterClients.get(target);
  adapterClients.delete(target);
  adapterRedis?.disconnect();
};

const TABLES_TO_TRUNCATE = [
  "game_stats",
  "room_players",
  "room",
  "crossword",
  "user_crossword_pack",
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
    pack: "general",
    ...overrides,
  });
  return repository.save(crossword);
};

const buildMaskedGrid = (crossword: Crossword) =>
  Array.isArray(crossword.grid)
    ? crossword.grid.map((value) => (value === "." ? "." : "*"))
    : [];

const createRoomWithPlayers = async (
  players: User[],
  overrides: Partial<Room> = {},
) => {
  const repository = dataSource.getRepository(Room);
  const crossword = overrides.crossword ?? await createCrossword();
  const defaultScores = players.reduce<Record<number, number>>(
    (acc, player) => {
      acc[player.id] = 0;
      return acc;
    },
    {},
  );
  const room = repository.create({
    type: "1v1",
    status: "pending",
    difficulty: "easy",
    players,
    crossword,
    scores: overrides.scores ?? defaultScores,
    found_letters: overrides.found_letters ?? buildMaskedGrid(crossword),
    ...overrides,
  });
  const saved = await repository.save(room);
  return repository.findOneOrFail({ where: { id: saved.id } });
};

const createRoomForUser = async (
  user: User,
  overrides: Partial<Room> = {},
) => createRoomWithPlayers([user], overrides);

const buildAuthToken = (user: User) =>
  jwt.sign(
    { sub: user.id, roles: user.roles },
    config.auth.secretAccessToken,
    { expiresIn: "1h" },
  );

const connectClient = async (user: User, targetServerUrl = serverUrl) => {
  const token = buildAuthToken(user);
  const client = createClient(targetServerUrl, {
    auth: { authToken: token },
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    timeout: 5000,
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

  return client;
};

const waitForUserStatus = (userId: number, status: "online" | "offline") =>
  waitFor(async () => {
    const stored = await dataSource.getRepository(User).findOneByOrFail({
      id: userId,
    });
    if (stored.status !== status) {
      throw new Error(`User not ${status} yet`);
    }
    return stored;
  });

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

const waitForClientEvent = <T = any>(
  client: Socket,
  event: string,
  timeout = 5000,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${event}" event`)),
      timeout,
    );

    const handler = (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    };

    client.once(event, handler);
  });

const waitForClientEvents = <T = any>(
  client: Socket,
  events: string[],
  timeout = 10000,
): Promise<{ event: string; payload: T }> =>
  new Promise((resolve, reject) => {
    const handlers: Record<string, (payload: T) => void> = {};
    const received: Array<{ event: string; payload: T }> = [];

    const cleanup = (event: string, payload: T) => {
      clearTimeout(timer);
      for (const evt of events) {
        const handler = handlers[evt];
        if (handler) {
          client.off(evt, handler);
        }
      }
      resolve({ event, payload });
    };

    for (const event of events) {
      const handler = (payload: T) => {
        received.push({ event, payload });
        cleanup(event, payload);
      };
      handlers[event] = handler;
      client.once(event, handler);
    }

    const timer = setTimeout(() => {
      for (const evt of events) {
        const handler = handlers[evt];
        if (handler) {
          client.off(evt, handler);
        }
      }
      reject(
        new Error(
          `Timed out waiting for one of the events: ${
            events.join(", ")
          }. Received so far: ${JSON.stringify(received)}`,
        ),
      );
    }, timeout);
  });

const startAdditionalServer = async () => {
  if (!dataSource) {
    throw new Error("Data source not initialized");
  }
  const extraApp = Fastify({ logger: false });
  await registerSocketIO(extraApp);
  extraApp.decorate("orm", dataSource as unknown as PluginDataSource);
  socketsRoutes(extraApp as any, {}, () => {});
  await extraApp.ready();
  await extraApp.listen({ port: 0, host: "127.0.0.1" });
  const address = extraApp.server.address() as AddressInfo;
  additionalServers.push(extraApp);
  return {
    app: extraApp,
    url: `http://127.0.0.1:${address.port}`,
  };
};

beforeAll(async () => {
  await postgres.setup();
  dataSource = postgres.dataSource;

  await redisManager.setup();
  await redisManager.flush();

  app = Fastify({ logger: false });
  await registerSocketIO(app);
  app.decorate("orm", dataSource as unknown as PluginDataSource);

  socketsRoutes(app as any, {}, () => {});
  await app.ready();
  singletonFastify.io = app.io as any;
  singletonFastify.log = app.log as any;

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
  while (additionalServers.length > 0) {
    const server = additionalServers.pop();
    if (server) {
      await closeServer(server);
    }
  }
});

afterAll(async () => {
  await closeServer(app);
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
    gameAutoRevealQueue.close(),
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
      reconnection: false,
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

    await waitForUserStatus(user.id, "online");

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

    await waitForUserStatus(user.id, "offline");
  });

  it("joins room channels before the client sees connect", async () => {
    const user = await createUser();
    const room = await createRoomForUser(user, { status: "playing" });
    const client = await connectClient(user);

    // No waiting: membership must already be in place when connect fires
    const serverSocket = app.io.of("/").sockets.get(client.id!);
    expect(serverSocket?.rooms.has(room.id.toString())).toBe(true);
    expect(serverSocket?.rooms.has(`user_${user.id}`)).toBe(true);
  });

  it("keeps a user online while another instance still holds a socket", async () => {
    const user = await createUser();
    await createRoomForUser(user);
    const { url: secondaryUrl } = await startAdditionalServer();

    const primaryClient = await connectClient(user);
    const secondaryClient = await connectClient(user, secondaryUrl);

    await disconnectClient(primaryClient);
    // Give the disconnect handler time to (incorrectly) mark the user offline
    await new Promise((resolve) => setTimeout(resolve, 300));
    const stillOnline = await dataSource.getRepository(User).findOneByOrFail({
      id: user.id,
    });
    expect(stillOnline.status).toBe("online");

    await disconnectClient(secondaryClient);
    await waitForUserStatus(user.id, "offline");
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

  it("delivers user-channel events emitted from another instance", async () => {
    const user = await createUser();
    const room = await createRoomForUser(user);
    const client = await connectClient(user);
    const { app: secondaryApp } = await startAdditionalServer();

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

    await createSocketEventService(secondaryApp).emitToUsers(
      [user.id],
      "room_cancelled",
      {
        roomId: room.id,
        message: "Room cancelled by host",
        reason: "host_left",
      },
    );

    const payload = await cancellationEvent;
    expect(payload.roomId).toBe(room.id);
    expect(payload.reason).toBe("host_left");
    expect(payload.message).toBe("Room cancelled by host");

    await disconnectClient(client);
  });

  it("rejects invalid token connections", async () => {
    const client = createClient(serverUrl, {
      auth: { authToken: "totally-invalid" },
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      timeout: 2000,
    });
    activeClients.push(client);

    const { event, payload } = await waitForClientEvents<any>(
      client,
      ["error", "connect_error"],
    );
    // Rejected in the handshake middleware, so the client never connects
    expect(event).toBe("connect_error");
    expect(payload).toBeInstanceOf(Error);
    expect(payload.message).toBe("auth/invalid-token");
    expect(payload.data).toEqual({ code: "auth/invalid-token" });

    await waitFor(async () => {
      if (client.connected) {
        throw new Error("Client still connected");
      }
      return true;
    });

    await disconnectClient(client);
  });

  it("updates lastActiveAt when heartbeat events arrive", async () => {
    const user = await createUser({ lastActiveAt: new Date("2000-01-01") });
    const room = await createRoomForUser(user);
    const client = await connectClient(user);

    const baseline = (await dataSource.getRepository(User).findOneByOrFail({
      id: user.id,
    })).lastActiveAt;

    client.emit("heartbeat");

    const updated = await waitFor(async () => {
      const stored = await dataSource.getRepository(User).findOneByOrFail({
        id: user.id,
      });
      if (stored.lastActiveAt <= baseline) {
        throw new Error("Heartbeat not processed yet");
      }
      return stored;
    });

    expect(updated.status).toBe("online");

    await disconnectClient(client);
  });

  it("loads room snapshots and reports missing rooms", async () => {
    const user = await createUser();
    const room = await createRoomForUser(user, { status: "playing" });
    const client = await connectClient(user);

    const roomPayloadPromise = waitForClientEvent<any>(client, "room");
    client.emit("loadRoom", { roomId: room.id });
    const payload = await roomPayloadPromise;
    expect(payload.id).toBe(room.id);
    expect(payload.players.some((player: any) => player.id === user.id)).toBe(
      true,
    );

    const errorPromise = waitForClientEvent<string>(client, "error");
    client.emit("loadRoom", { roomId: 999999 });
    const errorPayload = await errorPromise;
    expect(errorPayload).toBe("Room not found");

    await disconnectClient(client);
  });

  it("answers room:sync through the ack", async () => {
    const user = await createUser();
    const room = await createRoomForUser(user, { status: "playing" });
    const client = await connectClient(user);

    const found = await client
      .timeout(5000)
      .emitWithAck("room:sync", { roomId: room.id });
    expect(found.room.id).toBe(room.id);
    expect(found.room.status).toBe("playing");

    const missing = await client
      .timeout(5000)
      .emitWithAck("room:sync", { roomId: 999999 });
    expect(missing).toEqual({ error: "Room not found" });
  });

  it("lists the user's open rooms through rooms:active", async () => {
    const user = await createUser();
    const pending = await createRoomForUser(user, { status: "pending" });
    const playing = await createRoomForUser(user, { status: "playing" });
    await createRoomForUser(user, { status: "finished" });
    const client = await connectClient(user);

    const response = await client.timeout(5000).emitWithAck("rooms:active", {});
    const ids = response.rooms.map((room: any) => room.id).sort();
    expect(ids).toEqual([pending.id, playing.id].sort());
  });

  it("acks guesses and applies a retried guessId only once", async () => {
    const user = await createUser();
    const room = await createRoomForUser(user, { status: "playing" });
    const client = await connectClient(user);
    const guess = { roomId: room.id, x: 0, y: 0, guess: "Z", guessId: "g-1" };

    const first = await client.timeout(5000).emitWithAck("guess", guess);
    expect(first.success).toBe(true);
    expect(first.duplicate).toBeUndefined();
    const scoreAfterFirst = first.room.scores[user.id];
    expect(scoreAfterFirst).toBeLessThan(0);

    const retry = await client.timeout(5000).emitWithAck("guess", guess);
    expect(retry.success).toBe(true);
    expect(retry.duplicate).toBe(true);
    expect(retry.room.scores[user.id]).toBe(scoreAfterFirst);

    const fresh = await client
      .timeout(5000)
      .emitWithAck("guess", { ...guess, guessId: "g-2" });
    expect(fresh.duplicate).toBeUndefined();
    expect(fresh.room.scores[user.id]).toBeLessThan(scoreAfterFirst);
  });

  it("lets a failed guess be retried with the same guessId", async () => {
    const user = await createUser();
    await createRoomForUser(user, { status: "playing" });
    const client = await connectClient(user);
    const guess = { roomId: 999999, x: 0, y: 0, guess: "A", guessId: "g-fail" };

    const failed = await client.timeout(5000).emitWithAck("guess", guess);
    expect(failed.success).toBe(false);
    await expect(redisService.claimGuessId(999999, "g-fail", 60)).resolves.toBe(
      true,
    );
  });

  it("recovers the session and replays missed room events after a blip", async () => {
    const user = await createUser();
    const room = await createRoomForUser(user, { status: "playing" });
    const client = createClient(serverUrl, {
      auth: { authToken: buildAuthToken(user) },
      transports: ["websocket"],
      forceNew: true,
      reconnectionDelay: 100,
      reconnectionDelayMax: 200,
    });
    activeClients.push(client);
    await waitForClientEvent(client, "connect");
    await waitForUserStatus(user.id, "online");

    // Recovery needs the offset of a broadcast the client has already received
    const firstBroadcast = waitForClientEvent(client, "room");
    app.io.to(room.id.toString()).emit("room", { id: room.id, marker: "seen" });
    await firstBroadcast;

    const missed: any[] = [];
    client.on("room", (payload) => missed.push(payload));
    // The socket's own connect (not the manager's reconnect) marks recovery
    const reconnected = waitForClientEvent(client, "connect");

    // Simulate a network drop, then emit while the client is away
    client.io.engine.close();
    await waitFor(async () => {
      if (app.io.of("/").sockets.size !== 0) {
        throw new Error("Server still sees the socket");
      }
      return true;
    });
    app.io.to(room.id.toString()).emit("room", { id: room.id, marker: "missed" });

    await reconnected;
    expect(client.recovered).toBe(true);
    await waitFor(async () => {
      if (!missed.some((payload) => payload.marker === "missed")) {
        throw new Error("Missed event not replayed yet");
      }
      return true;
    });

    const serverSocket = app.io.of("/").sockets.get(client.id!);
    expect(serverSocket?.data.userId).toBe(user.id);
    expect(serverSocket?.rooms.has(room.id.toString())).toBe(true);
  });

  it("processes guesses and broadcasts updated room state", async () => {
    const user = await createUser();
    const room = await createRoomForUser(user, { status: "playing" });
    const client = await connectClient(user);

    const roomEvent = waitForClientEvent<any>(client, "room");
    client.emit("guess", { roomId: room.id, x: 0, y: 0, guess: "A" });
    const payload = await roomEvent;
    expect(payload.id).toBe(room.id);
    expect(payload.found_letters[0]).toBe("A");

    await disconnectClient(client);
  });

  it("returns an error payload when guess handling fails", async () => {
    const user = await createUser();
    const room = await createRoomForUser(user, { status: "playing" });
    const client = await connectClient(user);

    const errorPromise = waitForClientEvent<{ message: string }>(
      client,
      "error",
    );
    client.emit("guess", {
      roomId: room.id + 9999,
      x: 0,
      y: 0,
      guess: "Z",
    });
    const payload = await errorPromise;
    expect(payload).toEqual({ message: "Failed to process guess" });

    await disconnectClient(client);
  });

  it("delivers direct messages through the Redis socket bus", async () => {
    const user = await createUser();
    await createRoomForUser(user);
    const client = await connectClient(user);

    const messagePromise = waitForClientEvent<string>(client, "message");
    client.emit("message", { message: "hello there" });
    const payload = await messagePromise;
    expect(payload).toBe("hello there");

    await disconnectClient(client);
  });

  it("broadcasts room chat messages to other participants", async () => {
    const userA = await createUser();
    const userB = await createUser();
    const room = await createRoomWithPlayers([userA, userB], {
      status: "playing",
    });
    const clientA = await connectClient(userA);
    const clientB = await connectClient(userB);

    const messagePromise = waitForClientEvent<number>(clientB, "message");
    clientA.emit("message_room", { roomId: room.id, message: "ping" });
    const payload = await messagePromise;
    expect(payload).toBe(room.id);

    await disconnectClient(clientA);
    await disconnectClient(clientB);
  });

  it("broadcasts room updates across multiple socket servers", async () => {
    const userA = await createUser();
    const userB = await createUser();
    const room = await createRoomWithPlayers([userA, userB], {
      status: "playing",
    });

    const { app: secondaryApp, url: secondaryUrl } = await startAdditionalServer();

    const clientA = await connectClient(userA);
    const clientB = await connectClient(userB, secondaryUrl);

    await waitFor(async () => {
      const socketA = app.io.of("/").sockets.get(clientA.id);
      if (!socketA) {
        throw new Error("Client A not on primary server yet");
      }
      return true;
    });

    await waitFor(async () => {
      const socketB = secondaryApp.io.of("/").sockets.get(clientB.id);
      if (!socketB) {
        throw new Error("Client B not on secondary server yet");
      }
      return true;
    });

    const roomEventA = waitForClientEvent<any>(clientA, "room");
    const roomEventB = waitForClientEvent<any>(clientB, "room");

    clientA.emit("guess", { roomId: room.id, x: 0, y: 0, guess: "A" });

    const [payloadA, payloadB] = await Promise.all([roomEventA, roomEventB]);

    expect(payloadA.id).toBe(room.id);
    expect(payloadB.id).toBe(room.id);
    expect(payloadA.found_letters[0]).toBe("A");
    expect(payloadB.found_letters[0]).toBe("A");

    await disconnectClient(clientA);
    await disconnectClient(clientB);
  });

  it("notifies players when a room is forfeited", async () => {
    const userA = await createUser();
    const userB = await createUser();
    const room = await createRoomWithPlayers([userA, userB], {
      status: "playing",
    });
    const clientA = await connectClient(userA);
    const clientB = await connectClient(userB);

    // Seed Redis so forfeit goes through onGameEnd (emits game_forfeited), not cleanup
    const cached = room.createRoomCache();
    cached.userGuessCounts[userA.id] = { correct: 1, incorrect: 0 };
    await redisService.cacheGame(room.id.toString(), cached);

    const roomPromise = waitForClientEvent<any>(clientA, "room");
    const forfeitPromise = waitForClientEvent<any>(clientB, "game_forfeited");

    clientA.emit("forfeit", { roomId: room.id });

    const updatedRoom = await roomPromise;
    expect(updatedRoom.id).toBe(room.id);

    const forfeitEvent = await forfeitPromise;
    expect(forfeitEvent.forfeitedBy).toBe(userA.id);
    expect(forfeitEvent.room.id).toBe(room.id);

    await disconnectClient(clientA);
    await disconnectClient(clientB);
  });

  it("responds to ping events with pong", async () => {
    const user = await createUser();
    await createRoomForUser(user);
    const client = await connectClient(user);

    const pongPromise = waitForClientEvent<void>(client, "pong");
    client.emit("ping");
    await pongPromise;

    await disconnectClient(client);
  });
});
