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

  it("accepts JSON-encoded token arrays when sending notifications", async () => {
    const expoMock = new ExpoClientMock();
    const service = new NotificationService(
      dataSource,
      createLogger(),
      expoMock as unknown as Expo,
      {
        expo: { enabled: true },
      },
    );

    const sender = await createUser({ username: "RequestSender" });
    const receiverToken = "ExponentPushToken[1234567890abcdefgh]";
    const receiver = await createUser({
      username: "RequestReceiver",
      attributes: [
        { key: "expoPushToken", value: JSON.stringify([receiverToken]) },
      ],
    });

    const tickets = await service.notifyFriendRequest({
      senderId: sender.id,
      receiverId: receiver.id,
    });

    expect(expoMock.sent).toHaveLength(1);
    expect(expoMock.sent[0][0].to).toBe(receiverToken);
    expect(tickets).toBeDefined();
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

  it("sends a challenge notification with navigation metadata when challenged user has tokens", async () => {
    const expoMock = new ExpoClientMock();
    const service = new NotificationService(
      dataSource,
      createLogger(),
      expoMock as unknown as Expo,
      {
        expo: { enabled: true },
      },
    );

    const challenger = await createUser({ username: "ChallengerUser" });
    const challengedToken = "ExponentPushToken[challengetoken123456]";
    const challenged = await createUser({
      username: "ChallengedUser",
      attributes: [
        { key: "expoPushToken", value: challengedToken },
      ],
    });

    const payload = {
      challengerId: challenger.id,
      challengedId: challenged.id,
      roomId: 123,
      difficulty: "medium",
      context: "Friendly match",
    };

    const tickets = await service.notifyChallengeReceived(payload);

    expect(expoMock.sent).toHaveLength(1);
    expect(expoMock.sent[0]).toHaveLength(1);
    const message = expoMock.sent[0][0];
    expect(message.to).toBe(challengedToken);
    expect(message.title).toBe("New Challenge");
    expect(message.body).toContain("ChallengerUser");
    expect(message.body).toContain("Medium");
    const messageData = message.data as Record<string, unknown>;
    expect(messageData).toMatchObject({
      type: "challenge",
      roomId: payload.roomId,
      challengerId: challenger.id,
      challengedId: challenged.id,
      difficulty: payload.difficulty,
      context: payload.context,
      url: "/(root)/(tabs)/friends?tab=challenges",
      navigate: {
        pathname: "/(root)/(tabs)/friends",
        params: { tab: "challenges" },
      },
    });
    expect(tickets).toBeDefined();
    expect(tickets).toHaveLength(1);
    expect(tickets?.[0].status).toBe("ok");
  });

  it("does not send a challenge notification when challenged user lacks valid tokens", async () => {
    const expoMock = new ExpoClientMock();
    const service = new NotificationService(
      dataSource,
      createLogger(),
      expoMock as unknown as Expo,
      {
        expo: { enabled: true },
      },
    );

    const challenger = await createUser({ username: "NoTokenChallenger" });
    const challenged = await createUser({
      username: "NoTokenChallenged",
      attributes: [
        { key: "expoPushToken", value: "invalid-token" },
      ],
    });

    const tickets = await service.notifyChallengeReceived({
      challengerId: challenger.id,
      challengedId: challenged.id,
      roomId: 456,
      difficulty: "hard",
    });

    expect(expoMock.sent).toHaveLength(0);
    expect(tickets).toBeUndefined();
  });

  it("sends a challenge accepted notification to the challenger", async () => {
    const expoMock = new ExpoClientMock();
    const service = new NotificationService(
      dataSource,
      createLogger(),
      expoMock as unknown as Expo,
      {
        expo: { enabled: true },
      },
    );

    const challengerToken = "ExponentPushToken[challengeaccepted123]";
    const challenger = await createUser({
      username: "ChallengeInitiator",
      attributes: [
        { key: "expoPushToken", value: challengerToken },
      ],
    });
    const challenged = await createUser({ username: "Challengee" });

    const payload = {
      challengerId: challenger.id,
      challengedId: challenged.id,
      roomId: 789,
      difficulty: "hard",
    };

    const tickets = await service.notifyChallengeAccepted(payload);

    expect(expoMock.sent).toHaveLength(1);
    const message = expoMock.sent[0][0];
    expect(message.to).toBe(challengerToken);
    expect(message.title).toBe("Challenge Accepted");
    expect(message.body).toContain("Challengee");
    expect(message.body).toContain("Hard");
    expect(message.data).toMatchObject({
      type: "challenge_accepted",
      roomId: payload.roomId,
      challengerId: payload.challengerId,
      challengedId: payload.challengedId,
      difficulty: payload.difficulty,
    });
    expect(tickets).toBeDefined();
    expect(tickets?.[0].status).toBe("ok");
  });
});
