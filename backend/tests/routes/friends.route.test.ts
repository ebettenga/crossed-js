import Fastify from "fastify";
import { DataSource } from "typeorm";
import type { PluginDataSource } from "typeorm-fastify-plugin";
import { Friend, FriendshipStatus } from "../../src/entities/Friend";
import { GameStats } from "../../src/entities/GameStats";
import { Room } from "../../src/entities/Room";
import { User } from "../../src/entities/User";
import { Crossword } from "../../src/entities/Crossword";
import friendsRoutes from "../../src/routes/private/friends";
import { createPostgresTestManager } from "../utils/postgres";
import { ensureApprovedSnapshot } from "../utils/approval";

var emitToUsersMock: jest.Mock;
var createSocketEventServiceMock: jest.Mock;

jest.mock("../../src/services/SocketEventService", () => {
  emitToUsersMock = jest.fn();
  createSocketEventServiceMock = jest.fn(() => ({
    emitToUsers: emitToUsersMock,
  }));
  return {
    createSocketEventService: createSocketEventServiceMock,
    __esModule: true,
  };
});

const getEmitToUsersMock = () => emitToUsersMock;
const getCreateSocketEventServiceMock = () => createSocketEventServiceMock;

jest.setTimeout(60000);

const postgres = createPostgresTestManager({
  label: "Friends route tests",
  entities: [Friend, GameStats, Room, User, Crossword],
  env: {
    database: [
      "FRIEND_ROUTES_TEST_DB",
      "FRIEND_SERVICE_TEST_DB",
      "ROOM_SERVICE_TEST_DB",
      "POSTGRES_DB",
    ],
    schema: [
      "FRIEND_ROUTES_TEST_SCHEMA",
      "FRIEND_SERVICE_TEST_SCHEMA",
      "ROOM_SERVICE_TEST_SCHEMA",
    ],
    host: [
      "FRIEND_ROUTES_TEST_DB_HOST",
      "FRIEND_SERVICE_TEST_DB_HOST",
      "ROOM_SERVICE_TEST_DB_HOST",
      "PGHOST",
    ],
    port: [
      "FRIEND_ROUTES_TEST_DB_PORT",
      "FRIEND_SERVICE_TEST_DB_PORT",
      "ROOM_SERVICE_TEST_DB_PORT",
      "PGPORT",
    ],
    username: [
      "FRIEND_ROUTES_TEST_DB_USER",
      "FRIEND_SERVICE_TEST_DB_USER",
      "ROOM_SERVICE_TEST_DB_USER",
      "PGUSER",
    ],
    password: [
      "FRIEND_ROUTES_TEST_DB_PASSWORD",
      "FRIEND_SERVICE_TEST_DB_PASSWORD",
      "ROOM_SERVICE_TEST_DB_PASSWORD",
      "PGPASSWORD",
    ],
  },
  defaults: {
    database: "crossed_test",
    schema: "friends_route_test",
    host: "127.0.0.1",
    port: 5432,
    username: "postgres",
    password: "postgres",
  },
});

const TABLES_TO_TRUNCATE = [
  "room_players",
  "game_stats",
  "friend",
  "room",
  "crossword",
  "user",
];

let dataSource: DataSource;

const buildServer = async (user: User) => {
  const app = Fastify({ logger: false });

  app.decorate("orm", dataSource as unknown as PluginDataSource);
  app.decorateRequest("user", null);
  app.addHook("preHandler", (request, _reply, done) => {
    request.user = user;
    done();
  });

  friendsRoutes(app as any, {}, () => {});
  await app.ready();
  return app;
};

const createUser = async (overrides: Partial<User> = {}) => {
  const repository = dataSource.getRepository(User);
  const user = repository.create({
    username: `user_${Math.random().toString(36).slice(2, 8)}`,
    email: `${Date.now()}-${Math.random()}@test.com`,
    password: "password",
    roles: ["user"],
    status: "online",
    eloRating: 1200,
    ...overrides,
  });
  return repository.save(user);
};

const createFriendship = async (
  overrides: Partial<Friend> = {},
): Promise<Friend> => {
  const repository = dataSource.getRepository(Friend);
  const sender = overrides.sender || (await createUser());
  const receiver = overrides.receiver || (await createUser());
  const friendship = repository.create({
    sender,
    receiver,
    senderId: sender.id,
    receiverId: receiver.id,
    status: overrides.status ?? FriendshipStatus.PENDING,
    ...overrides,
  });
  return repository.save(friendship);
};

const sanitizeFriendRecord = (record: any) => ({
  id: record.id,
  status: record.status,
  senderId: record.senderId,
  receiverId: record.receiverId,
  senderUsername: record.sender ? record.sender.username : null,
  receiverUsername: record.receiver ? record.receiver.username : null,
  accepted: Boolean(record.acceptedAt),
});

beforeAll(async () => {
  await postgres.setup();
  dataSource = postgres.dataSource;
});

beforeEach(async () => {
  await postgres.truncate(TABLES_TO_TRUNCATE);
  getEmitToUsersMock().mockClear();
  getCreateSocketEventServiceMock().mockClear();
});

afterAll(async () => {
  await postgres.close();
});

describe("friends routes", () => {
  it("retrieves accepted friendships for the authenticated user", async () => {
    const owner = await createUser({ username: "owner" });
    const friendAsReceiver = await createUser({ username: "receiver_friend" });
    const friendAsSender = await createUser({ username: "sender_friend" });

    const sentFriendship = await createFriendship({
      sender: owner,
      receiver: friendAsReceiver,
      status: FriendshipStatus.ACCEPTED,
    });
    const receivedFriendship = await createFriendship({
      sender: friendAsSender,
      receiver: owner,
      status: FriendshipStatus.ACCEPTED,
    });
    await createFriendship({
      sender: owner,
      receiver: await createUser({ username: "pending_friend" }),
      status: FriendshipStatus.PENDING,
    });

    const app = await buildServer(owner);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/friends",
      });
      expect(response.statusCode).toBe(200);

      const payload = response.json() as Array<any>;

      expect(payload).toHaveLength(2);
      const sortedIds = payload.map((item) => item.id).sort((a, b) => a - b);
      expect(sortedIds).toEqual(
        [sentFriendship.id, receivedFriendship.id].sort((a, b) => a - b),
      );
      payload.forEach((item) => {
        expect(item.status).toBe(FriendshipStatus.ACCEPTED);
      });
      const sanitized = payload
        .map(sanitizeFriendRecord)
        .sort((a, b) => a.id - b.id);
      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "friends.route.test.ts",
        snapshotName: "accepted friends response",
        received: sanitized,
      });
      const emitMock = getEmitToUsersMock();
      expect(emitMock).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("lists pending friend requests for the authenticated user", async () => {
    const owner = await createUser({ username: "owner_pending" });
    const outboundTarget = await createUser({ username: "pending_target" });
    const inboundSender = await createUser({ username: "pending_sender" });

    const outbound = await createFriendship({
      sender: owner,
      receiver: outboundTarget,
      status: FriendshipStatus.PENDING,
    });
    const inbound = await createFriendship({
      sender: inboundSender,
      receiver: owner,
      status: FriendshipStatus.PENDING,
    });
    await createFriendship({
      sender: owner,
      receiver: await createUser({ username: "accepted_friend" }),
      status: FriendshipStatus.ACCEPTED,
    });

    const app = await buildServer(owner);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/friends/pending",
      });
      expect(response.statusCode).toBe(200);

      const payload = response.json() as Array<any>;

      expect(payload).toHaveLength(2);
      const sortedIds = payload.map((item) => item.id).sort((a, b) => a - b);
      expect(sortedIds).toEqual(
        [outbound.id, inbound.id].sort((a, b) => a - b),
      );
      payload.forEach((item) => {
        expect(item.status).toBe(FriendshipStatus.PENDING);
      });
      const sanitized = payload
        .map(sanitizeFriendRecord)
        .sort((a, b) => a.id - b.id);
      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "friends.route.test.ts",
        snapshotName: "pending friends response",
        received: sanitized,
      });
      const emitMock = getEmitToUsersMock();
      expect(emitMock).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("creates a friend request and emits socket updates", async () => {
    const sender = await createUser({ username: "sender_user" });
    const receiver = await createUser({ username: "receiver_user" });

    const app = await buildServer(sender);
    try {
      const response = await app.inject({
        method: "POST",
        url: "/friends",
        payload: { username: receiver.username.toUpperCase() },
      });
      expect(response.statusCode).toBe(200);

      const payload = response.json() as any;

      expect(payload.senderId).toBe(sender.id);
      expect(payload.receiverId).toBe(receiver.id);
      expect(payload.status).toBe(FriendshipStatus.PENDING);
      const sanitized = sanitizeFriendRecord(payload);
      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "friends.route.test.ts",
        snapshotName: "create friend request response",
        received: sanitized,
      });

      const stored = await dataSource
        .getRepository(Friend)
        .findOneByOrFail({ id: payload.id });
      expect(stored.status).toBe(FriendshipStatus.PENDING);

      const createMock = getCreateSocketEventServiceMock();
      const emitMock = getEmitToUsersMock();
      expect(createMock).toHaveBeenCalledTimes(1);
      expect(emitMock).toHaveBeenCalledTimes(1);
      const [recipients, event, eventPayload] = emitMock.mock.calls[0];
      expect(recipients).toEqual([stored.senderId, stored.receiverId]);
      expect(event).toBe("friends:updated");
      expect(eventPayload).toMatchObject({
        friendshipId: stored.id,
        status: FriendshipStatus.PENDING,
        action: "added",
      });
    } finally {
      await app.close();
    }
  });

  it("rejects duplicate friend requests when already pending or friends", async () => {
    const sender = await createUser({ username: "dup_sender" });
    const receiver = await createUser({ username: "dup_receiver" });

    await createFriendship({
      sender,
      receiver,
      status: FriendshipStatus.PENDING,
    });

    const app = await buildServer(sender);
    try {
      const response = await app.inject({
        method: "POST",
        url: "/friends",
        payload: { username: receiver.username },
      });
      expect(response.statusCode).toBe(400);
      const payload = response.json() as any;
      expect(payload.message).toBe("Friendship already exists");
    } finally {
      await app.close();
    }
  });

  it("accepts a friend request and emits socket updates", async () => {
    const receiver = await createUser({ username: "accept_receiver" });
    const sender = await createUser({ username: "accept_sender" });
    const friendship = await createFriendship({
      sender,
      receiver,
      status: FriendshipStatus.PENDING,
    });

    const app = await buildServer(receiver);
    try {
      const response = await app.inject({
        method: "POST",
        url: `/friends/${friendship.id}/accept`,
      });
      expect(response.statusCode).toBe(200);

      const payload = response.json() as any;

      expect(payload.status).toBe(FriendshipStatus.ACCEPTED);
      expect(payload.senderId).toBe(sender.id);
      expect(payload.receiverId).toBe(receiver.id);
      expect(payload.acceptedAt).toBeDefined();
      const sanitized = sanitizeFriendRecord(payload);
      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "friends.route.test.ts",
        snapshotName: "accept friend request response",
        received: sanitized,
      });

      const stored = await dataSource
        .getRepository(Friend)
        .findOneByOrFail({ id: friendship.id });
      expect(stored.status).toBe(FriendshipStatus.ACCEPTED);
      expect(stored.acceptedAt).toBeInstanceOf(Date);

      const emitMock = getEmitToUsersMock();
      expect(emitMock).toHaveBeenCalledTimes(1);
      const [recipients, event, eventPayload] = emitMock.mock.calls[0];
      expect(recipients).toEqual([sender.id, receiver.id]);
      expect(event).toBe("friends:updated");
      expect(eventPayload).toMatchObject({
        friendshipId: friendship.id,
        status: FriendshipStatus.ACCEPTED,
        action: "accepted",
      });
    } finally {
      await app.close();
    }
  });

  it("rejects a friend request and emits socket updates", async () => {
    const receiver = await createUser({ username: "reject_receiver" });
    const sender = await createUser({ username: "reject_sender" });
    const friendship = await createFriendship({
      sender,
      receiver,
      status: FriendshipStatus.PENDING,
    });

    const app = await buildServer(receiver);
    try {
      const response = await app.inject({
        method: "POST",
        url: `/friends/${friendship.id}/reject`,
      });
      expect(response.statusCode).toBe(200);

      const payload = response.json() as any;

      expect(payload.status).toBe(FriendshipStatus.REJECTED);
      expect(payload.senderId).toBe(sender.id);
      expect(payload.receiverId).toBe(receiver.id);
      const sanitized = sanitizeFriendRecord(payload);
      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "friends.route.test.ts",
        snapshotName: "reject friend request response",
        received: sanitized,
      });

      const stored = await dataSource
        .getRepository(Friend)
        .findOneByOrFail({ id: friendship.id });
      expect(stored.status).toBe(FriendshipStatus.REJECTED);

      const emitMock = getEmitToUsersMock();
      expect(emitMock).toHaveBeenCalledTimes(1);
      const [recipients, event, eventPayload] = emitMock.mock.calls[0];
      expect(recipients).toEqual([sender.id, receiver.id]);
      expect(event).toBe("friends:updated");
      expect(eventPayload).toMatchObject({
        friendshipId: friendship.id,
        status: FriendshipStatus.REJECTED,
        action: "rejected",
      });
    } finally {
      await app.close();
    }
  });

  it("removes a friend and confirms deletion", async () => {
    const owner = await createUser({ username: "delete_owner" });
    const friend = await createUser({ username: "delete_friend" });
    const friendship = await createFriendship({
      sender: owner,
      receiver: friend,
      status: FriendshipStatus.ACCEPTED,
    });

    const app = await buildServer(owner);
    try {
      const response = await app.inject({
        method: "DELETE",
        url: `/friends/${friendship.id}`,
      });
      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload).toEqual({ success: true });
      await ensureApprovedSnapshot({
        testFile: expect.getState().testPath ?? "friends.route.test.ts",
        snapshotName: "remove friend response",
        received: payload,
      });

      const stored = await dataSource
        .getRepository(Friend)
        .findOne({ where: { id: friendship.id } });
      expect(stored).toBeNull();

      const emitMock = getEmitToUsersMock();
      expect(emitMock).toHaveBeenCalledTimes(1);
      const [recipients, event, eventPayload] = emitMock.mock.calls[0];
      expect(recipients).toEqual([owner.id, friend.id]);
      expect(event).toBe("friends:updated");
      expect(eventPayload).toMatchObject({
        friendshipId: friendship.id,
        status: FriendshipStatus.ACCEPTED,
        action: "removed",
      });
    } finally {
      await app.close();
    }
  });
});
