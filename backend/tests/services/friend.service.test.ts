import { DataSource } from "typeorm";
import { FriendService } from "../../src/services/FriendService";
import { Friend, FriendshipStatus } from "../../src/entities/Friend";
import { User } from "../../src/entities/User";
import { GameStats } from "../../src/entities/GameStats";
import { Room } from "../../src/entities/Room";
import { Crossword } from "../../src/entities/Crossword";
import { NotFoundError } from "../../src/errors/api";
import { createPostgresTestManager } from "../utils/postgres";

jest.setTimeout(60000);

const postgres = createPostgresTestManager({
  label: "FriendService tests",
  entities: [User, Friend, GameStats, Room, Crossword],
  env: {
    database: [
      "FRIEND_SERVICE_TEST_DB",
      "ROOM_SERVICE_TEST_DB",
      "POSTGRES_DB",
    ],
    schema: [
      "FRIEND_SERVICE_TEST_SCHEMA",
      "ROOM_SERVICE_TEST_SCHEMA",
    ],
    host: [
      "FRIEND_SERVICE_TEST_DB_HOST",
      "ROOM_SERVICE_TEST_DB_HOST",
      "PGHOST",
    ],
    port: [
      "FRIEND_SERVICE_TEST_DB_PORT",
      "ROOM_SERVICE_TEST_DB_PORT",
      "PGPORT",
    ],
    username: [
      "FRIEND_SERVICE_TEST_DB_USER",
      "ROOM_SERVICE_TEST_DB_USER",
      "PGUSER",
    ],
    password: [
      "FRIEND_SERVICE_TEST_DB_PASSWORD",
      "ROOM_SERVICE_TEST_DB_PASSWORD",
      "PGPASSWORD",
    ],
  },
  defaults: {
    database: "crossed_test",
    schema: "friend_service_test",
    host: "127.0.0.1",
    port: 5432,
    username: "postgres",
    password: "postgres",
  },
});

let dataSource: DataSource;
let service: FriendService;
const TABLES_TO_TRUNCATE = [
  "room_players",
  "game_stats",
  "friend",
  "room",
  "crossword",
  "user",
];

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
    status: FriendshipStatus.PENDING,
    ...overrides,
  });
  return repository.save(friendship);
};

beforeAll(async () => {
  try {
    await postgres.setup();
    dataSource = postgres.dataSource;
    service = new FriendService(dataSource);
    await postgres.truncate(TABLES_TO_TRUNCATE);
  } catch (error) {
    console.error(
      "Failed to initialise FriendService integration environment. Check Postgres/Redis configuration.",
    );
    throw error;
  }
});

beforeEach(async () => {
  await postgres.truncate(TABLES_TO_TRUNCATE);
});

afterAll(async () => {
  await postgres.close();
});

describe("FriendService", () => {
  describe("addFriend", () => {
    it("creates a pending friendship for case-insensitive usernames", async () => {
      const sender = await createUser({ username: "sender" });
      const receiver = await createUser({ username: "ReceiverUser" });

      const friendship = await service.addFriend(sender.id, "receiveruser");

      expect(friendship.status).toBe(FriendshipStatus.PENDING);
      expect(friendship.senderId).toBe(sender.id);
      expect(friendship.receiverId).toBe(receiver.id);

      const saved = await dataSource
        .getRepository(Friend)
        .findOneByOrFail({ id: friendship.id });
      expect(saved.status).toBe(FriendshipStatus.PENDING);
    });

    it("throws when receiver does not exist", async () => {
      const sender = await createUser();
      await expect(
        service.addFriend(sender.id, "missing"),
      ).rejects.toThrow(NotFoundError);
    });

    it("prevents self friendship", async () => {
      const sender = await createUser({ username: "self" });

      await expect(
        service.addFriend(sender.id, "self"),
      ).rejects.toThrow("You cannot send a friend request to yourself");
    });

    it("prevents duplicate friendships", async () => {
      const sender = await createUser({ username: "sender" });
      const receiver = await createUser({ username: "receiver" });

      await service.addFriend(sender.id, receiver.username);

      await expect(
        service.addFriend(sender.id, receiver.username),
      ).rejects.toThrow("Friendship already exists");
    });
  });

  describe("getFriends", () => {
    it("returns accepted friendships where user is sender or receiver", async () => {
      const alice = await createUser({ username: "alice" });
      const bob = await createUser({ username: "bob" });
      const carol = await createUser({ username: "carol" });

      await createFriendship({
        sender: alice,
        receiver: bob,
        senderId: alice.id,
        receiverId: bob.id,
        status: FriendshipStatus.ACCEPTED,
      });

      await createFriendship({
        sender: carol,
        receiver: alice,
        senderId: carol.id,
        receiverId: alice.id,
        status: FriendshipStatus.ACCEPTED,
      });

      await createFriendship({
        sender: carol,
        receiver: bob,
        senderId: carol.id,
        receiverId: bob.id,
        status: FriendshipStatus.PENDING,
      });

      const friends = await service.getFriends(alice.id);
      expect(friends).toHaveLength(2);
      const counterpartIds = friends.map((f) =>
        f.senderId === alice.id ? f.receiverId : f.senderId
      );
      expect(counterpartIds.sort()).toEqual([bob.id, carol.id].sort());
    });
  });

  describe("getPendingRequests", () => {
    it("returns pending requests for both incoming and outgoing", async () => {
      const alice = await createUser({ username: "alice" });
      const bob = await createUser({ username: "bob" });
      const carol = await createUser({ username: "carol" });

      await createFriendship({
        sender: alice,
        receiver: bob,
        senderId: alice.id,
        receiverId: bob.id,
        status: FriendshipStatus.PENDING,
      });

      await createFriendship({
        sender: carol,
        receiver: alice,
        senderId: carol.id,
        receiverId: alice.id,
        status: FriendshipStatus.PENDING,
      });

      await createFriendship({
        sender: bob,
        receiver: carol,
        senderId: bob.id,
        receiverId: carol.id,
        status: FriendshipStatus.ACCEPTED,
      });

      const pending = await service.getPendingRequests(alice.id);
      expect(pending).toHaveLength(2);
      const pairs = pending.map((p) => [p.senderId, p.receiverId]);
      expect(pairs).toEqual([
        [alice.id, bob.id],
        [carol.id, alice.id],
      ]);
    });
  });

  describe("acceptFriendRequest", () => {
    it("accepts a pending request and sets acceptedAt", async () => {
      const receiver = await createUser({ username: "receiver" });
      const friendship = await createFriendship({
        receiver,
        receiverId: receiver.id,
        status: FriendshipStatus.PENDING,
      });

      const accepted = await service.acceptFriendRequest(
        receiver.id,
        friendship.id,
      );

      expect(accepted.status).toBe(FriendshipStatus.ACCEPTED);
      expect(accepted.acceptedAt).toBeInstanceOf(Date);
    });

    it("throws when friendship is missing", async () => {
      await expect(
        service.acceptFriendRequest(1, 99999),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws when user is not the receiver", async () => {
      const receiver = await createUser();
      const friendship = await createFriendship({
        receiver,
        receiverId: receiver.id,
      });
      const outsider = await createUser();

      await expect(
        service.acceptFriendRequest(outsider.id, friendship.id),
      ).rejects.toThrow("Not authorized to accept this request");
    });

    it("throws when request is not pending", async () => {
      const receiver = await createUser();
      const friendship = await createFriendship({
        receiver,
        receiverId: receiver.id,
        status: FriendshipStatus.ACCEPTED,
      });

      await expect(
        service.acceptFriendRequest(receiver.id, friendship.id),
      ).rejects.toThrow("Friend request is not pending");
    });
  });

  describe("rejectFriendRequest", () => {
    it("marks friendship as rejected", async () => {
      const sender = await createUser();
      const receiver = await createUser();
      const friendship = await createFriendship({
        sender,
        receiver,
        senderId: sender.id,
        receiverId: receiver.id,
      });

      const rejected = await service.rejectFriendRequest(
        receiver.id,
        friendship.id,
      );

      expect(rejected.status).toBe(FriendshipStatus.REJECTED);
    });

    it("throws when friendship is missing", async () => {
      await expect(
        service.rejectFriendRequest(1, 99999),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws when user is not receiver", async () => {
      const sender = await createUser();
      const receiver = await createUser();
      const friendship = await createFriendship({
        sender,
        receiver,
        senderId: sender.id,
        receiverId: receiver.id,
      });
      const outsider = await createUser();

      await expect(
        service.rejectFriendRequest(outsider.id, friendship.id),
      ).rejects.toThrow("Not authorized to reject this request");
    });
  });

  describe("removeFriend", () => {
    it("allows either participant to remove friendship", async () => {
      const sender = await createUser();
      const receiver = await createUser();
      const friendship = await createFriendship({
        sender,
        receiver,
        senderId: sender.id,
        receiverId: receiver.id,
        status: FriendshipStatus.ACCEPTED,
      });

      await service.removeFriend(sender.id, friendship.id);

      const remaining = await dataSource
        .getRepository(Friend)
        .findOneBy({ id: friendship.id });
      expect(remaining).toBeNull();
    });

    it("throws when friendship is missing", async () => {
      await expect(
        service.removeFriend(1, 12345),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws when user is not part of the friendship", async () => {
      const sender = await createUser();
      const receiver = await createUser();
      const outsider = await createUser();
      const friendship = await createFriendship({
        sender,
        receiver,
        senderId: sender.id,
        receiverId: receiver.id,
      });

      await expect(
        service.removeFriend(outsider.id, friendship.id),
      ).rejects.toThrow("Not authorized to remove this friendship");
    });
  });
});
