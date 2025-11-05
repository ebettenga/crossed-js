import { DataSource } from "typeorm";
import type { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import type { FastifyBaseLogger } from "fastify";
import { NotificationService } from "../../src/services/NotificationService";
import { User } from "../../src/entities/User";
import { GameStats } from "../../src/entities/GameStats";
import { Room } from "../../src/entities/Room";
import { UserCrosswordPack } from "../../src/entities/UserCrosswordPack";
import { Crossword } from "../../src/entities/Crossword";

import { createPostgresTestManager } from "../utils/postgres";

process.env.NOTIFICATION_SERVICE_TEST_DB ??= "crossed_test";

class ExpoClientMock {
  public sent: ExpoPushMessage[][] = [];

  chunkPushNotifications(messages: ExpoPushMessage[]): ExpoPushMessage[][] {
    return [messages];
  }

  async sendPushNotificationsAsync(
    chunk: ExpoPushMessage[],
  ): Promise<ExpoPushTicket[]> {
    this.sent.push(chunk);
    return chunk.map(() => ({ status: "ok" } as ExpoPushTicket));
  }
}

const createLogger = (): FastifyBaseLogger => {
  const noop = () => undefined;
  const logger = {
    level: "info",
    child: () => logger,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
    trace: noop,
  };
  return logger as unknown as FastifyBaseLogger;
};

jest.setTimeout(60000);

const postgres = createPostgresTestManager({
  label: "NotificationService tests",
  entities: [User, GameStats, Room, UserCrosswordPack, Crossword],
  env: {
    database: [
      "NOTIFICATION_SERVICE_TEST_DB",
      "ROOM_SERVICE_TEST_DB",
      "POSTGRES_DB",
    ],
    schema: ["NOTIFICATION_SERVICE_TEST_SCHEMA"],
    host: [
      "NOTIFICATION_SERVICE_TEST_DB_HOST",
      "ROOM_SERVICE_TEST_DB_HOST",
      "PGHOST",
    ],
    port: [
      "NOTIFICATION_SERVICE_TEST_DB_PORT",
      "ROOM_SERVICE_TEST_DB_PORT",
      "PGPORT",
    ],
    username: [
      "NOTIFICATION_SERVICE_TEST_DB_USER",
      "ROOM_SERVICE_TEST_DB_USER",
      "PGUSER",
    ],
    password: [
      "NOTIFICATION_SERVICE_TEST_DB_PASSWORD",
      "ROOM_SERVICE_TEST_DB_PASSWORD",
      "PGPASSWORD",
    ],
  },
  defaults: {
    database: "crossed_test",
    schema: "notification_service_test",
    host: "127.0.0.1",
    port: 5432,
    username: "postgres",
    password: "postgres",
  },
});

let dataSource: DataSource;
const TABLES_TO_TRUNCATE = [
  "room_players",
  "game_stats",
  "room",
  "user_crossword_pack",
  "user",
];

const createUser = async (overrides: Partial<User> = {}) => {
  const repository = dataSource.getRepository(User);
  const user = repository.create({
    username: `user_${Math.random().toString(36).slice(2, 8)}`,
    email: `${Date.now()}-${Math.random()}@test.com`,
    password: "password",
    roles: ["user"],
    status: "offline",
    eloRating: 1200,
    ...overrides,
  });
  return repository.save(user);
};

describe("NotificationService", () => {
  beforeAll(async () => {
    try {
      await postgres.setup();
      dataSource = postgres.dataSource;
      await postgres.truncate(TABLES_TO_TRUNCATE);
    } catch (error) {
      console.error("Failed to initialise NotificationService tests", error);
      throw error;
    }
  });

  beforeEach(async () => {
    await postgres.truncate(TABLES_TO_TRUNCATE);
  });

  afterAll(async () => {
    await postgres.close();
  });

  it("sends a friend request notification when receiver has Expo push tokens", async () => {
    const expoMock = new ExpoClientMock();
    const service = new NotificationService(
      dataSource,
      createLogger(),
      expoMock as unknown as Expo,
      {
        expo: { enabled: true },
      },
    );

    const sender = await createUser({ username: "SenderUser" });
    const receiverToken = "ExponentPushToken[abcdefgh1234567890ijkl]";
    const receiver = await createUser({
      username: "ReceiverUser",
      attributes: [
        { key: "expoPushToken", value: receiverToken },
      ],
    });

    let tickets: ExpoPushTicket[] | void;
    try {
      tickets = await service.notifyFriendRequest({
        senderId: sender.id,
        receiverId: receiver.id,
      });
    } catch (error) {
      console.error("notifyFriendRequest error (with tokens)", error);
      throw error;
    }

    expect(expoMock.sent).toHaveLength(1);
    expect(expoMock.sent[0]).toHaveLength(1);
    expect(expoMock.sent[0][0].to).toBe(receiverToken);
    expect(expoMock.sent[0][0].sound).toBe("default");
    expect(expoMock.sent[0][0].body).toContain("SenderUser");
    expect(tickets).toBeDefined();
    expect(tickets).toHaveLength(1);
    expect(tickets?.[0].status).toBe("ok");
  });

  it("does not send notifications when receiver has no valid tokens", async () => {
    const expoMock = new ExpoClientMock();
    const service = new NotificationService(
      dataSource,
      createLogger(),
      expoMock as unknown as Expo,
      {
        expo: { enabled: true },
      },
    );

    const sender = await createUser({ username: "Sender" });
    const receiver = await createUser({
      username: "Receiver",
      attributes: [
        { key: "expoPushToken", value: "not-a-token" },
      ],
    });

    let tickets: ExpoPushTicket[] | void;
    try {
      tickets = await service.notifyFriendRequest({
        senderId: sender.id,
        receiverId: receiver.id,
      });
    } catch (error) {
      console.error("notifyFriendRequest error (without tokens)", error);
      throw error;
    }

    expect(expoMock.sent).toHaveLength(0);
    expect(tickets).toBeUndefined();
  });
});
