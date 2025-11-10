import Fastify, { type FastifyInstance } from "fastify";
import fastifyIO from "fastify-socket.io";
import { io as createClient, type Socket } from "socket.io-client";
import { AddressInfo } from "net";
import jwt from "jsonwebtoken";
import { DataSource } from "typeorm";
import type { PluginDataSource } from "typeorm-fastify-plugin";

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

const connectClient = async (user: User) => {
  const token = buildAuthToken(user);
  const client = createClient(serverUrl, {
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

  it("rejects invalid token connections", async () => {
    const client = createClient(serverUrl, {
      auth: { authToken: "totally-invalid" },
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      timeout: 2000,
    });
    activeClients.push(client);

    await new Promise<void>((resolve) => {
      client.once("connect", () => resolve());
      client.once("connect_error", () => resolve());
    });

    const payload = await waitForClientEvent<{ code: string }>(
      client,
      "error",
    );
    expect(payload).toEqual({ code: "auth/invalid-token" });

    await waitFor(async () => {
      if (client.connected) {
        throw new Error("Client still connected");
      }
      return true;
    });
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
      roomId: room.id,
      x: 10,
      y: 10,
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

  it("notifies players when a room is forfeited", async () => {
    const userA = await createUser();
    const userB = await createUser();
    const room = await createRoomWithPlayers([userA, userB], {
      status: "playing",
    });
    const clientA = await connectClient(userA);
    const clientB = await connectClient(userB);

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

  it("creates and accepts challenges, notifying all participants", async () => {
    const challenger = await createUser();
    const challenged = await createUser();
    const challengerClient = await connectClient(challenger);
    const challengedClient = await connectClient(challenged);

    const challengeRoomPromise = waitForClientEvent<any>(
      challengerClient,
      "room",
    );
    const createdUpdatePromise = waitForClientEvent<any>(
      challengedClient,
      "challenges:updated",
    );

    challengerClient.emit(
      "challenge",
      JSON.stringify({
        challengedId: challenged.id,
        difficulty: "easy",
      }),
    );

    const createdUpdate = await createdUpdatePromise;
    expect(createdUpdate.action).toBe("created");

    const challengeRoom = await challengeRoomPromise;
    const roomId = challengeRoom.id;

    const acceptRoomPromise = waitForClientEvent<any>(
      challengedClient,
      "room",
    );
    const acceptedUpdatePromise = waitForClientEvent<any>(
      challengerClient,
      "challenges:updated",
    );

    challengedClient.emit(
      "accept_challenge",
      JSON.stringify({ roomId }),
    );

    const acceptedUpdate = await acceptedUpdatePromise;
    expect(acceptedUpdate.action).toBe("accepted");
    expect(acceptedUpdate.roomId).toBe(roomId);

    const acceptedRoom = await acceptRoomPromise;
    expect(acceptedRoom.id).toBe(roomId);

    await disconnectClient(challengerClient);
    await disconnectClient(challengedClient);
  });

  it("notifies participants when a challenge is rejected", async () => {
    const challenger = await createUser();
    const challenged = await createUser();
    const challengerClient = await connectClient(challenger);
    const challengedClient = await connectClient(challenged);

    const challengerRoomPromise = waitForClientEvent<any>(
      challengerClient,
      "room",
    );
    challengerClient.emit(
      "challenge",
      JSON.stringify({
        challengedId: challenged.id,
        difficulty: "easy",
      }),
    );
    const challengeRoom = await challengerRoomPromise;

    const rejectUpdatePromise = waitForClientEvent<any>(
      challengerClient,
      "challenges:updated",
    );
    challengedClient.emit(
      "reject_challenge",
      JSON.stringify({ roomId: challengeRoom.id }),
    );

    const rejected = await rejectUpdatePromise;
    expect(rejected.action).toBe("rejected");
    expect(rejected.roomId).toBe(challengeRoom.id);

    await disconnectClient(challengerClient);
    await disconnectClient(challengedClient);
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
