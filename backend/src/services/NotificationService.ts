import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import type { FastifyBaseLogger } from "fastify";
import type { DataSource } from "typeorm";
import { User } from "../entities/User";
import { config } from "../config/config";

type FriendRequestPayload = {
  senderId: number;
  receiverId: number;
};

type NotificationsConfig = {
  expo: {
    enabled: boolean;
    accessToken?: string;
    useFcmV1?: boolean;
    tokenAttributes?: string[];
  };
  defaults?: {
    sound?: string | null;
  };
  templates?: {
    friendRequest?: {
      title?: string;
      body?: string;
    };
  };
};

const mergeNotificationsConfig = (
  base: NotificationsConfig,
  overrides?: Partial<NotificationsConfig>,
): NotificationsConfig => {
  if (!overrides) {
    return base;
  }

  return {
    expo: {
      ...base.expo,
      ...overrides.expo,
      tokenAttributes: overrides.expo?.tokenAttributes
        ? [...overrides.expo.tokenAttributes]
        : base.expo.tokenAttributes,
    },
    defaults: {
      ...base.defaults,
      ...overrides.defaults,
    },
    templates: {
      friendRequest: {
        ...base.templates?.friendRequest,
        ...overrides.templates?.friendRequest,
      },
    },
  };
};

export class NotificationService {
  private ormConnection: DataSource;
  private logger: FastifyBaseLogger;
  private expo: Expo | null;
  private settings: NotificationsConfig;

  constructor(
    ormConnection: DataSource,
    logger: FastifyBaseLogger,
    expoClient?: Expo,
    overrides?: Partial<NotificationsConfig>,
  ) {
    this.ormConnection = ormConnection;
    this.logger = logger;
    this.settings = mergeNotificationsConfig(config.notifications, overrides);

    if (!this.settings.expo.enabled) {
      this.expo = null;
      return;
    }

    this.expo = expoClient ?? new Expo({
      accessToken: this.settings.expo.accessToken,
      useFcmV1: this.settings.expo.useFcmV1,
    });
  }

  async notifyFriendRequest(
    payload: FriendRequestPayload,
  ): Promise<ExpoPushTicket[] | void> {
    if (!this.settings.expo.enabled) {
      this.logger.info(
        { event: "notifications.friend_request", reason: "disabled" },
        "Skipping friend request notification because notifications are disabled.",
      );
      return;
    }

    try {
      const tickets = await this.sendFriendRequestNotification(payload);
      return tickets;
    } catch (error) {
      this.logger.error(
        { err: error, event: "notifications.friend_request" },
        "Failed to send friend request notification.",
      );
    }
  }

  private async sendFriendRequestNotification(
    { senderId, receiverId }: FriendRequestPayload,
  ): Promise<ExpoPushTicket[] | void> {
    if (!this.expo) {
      this.logger.info(
        {
          event: "notifications.friend_request",
          reason: "expo_not_configured",
        },
        "Expo client not configured. Skipping notification.",
      );
      return;
    }

    const userRepository = this.ormConnection.getRepository(User);

    const [sender, receiver] = await Promise.all([
      userRepository.findOne({
        where: { id: senderId },
        select: ["id", "username"],
      }),
      userRepository
        .createQueryBuilder("user")
        .select(["user.id", "user.username"])
        .addSelect("user.attributes")
        .where("user.id = :receiverId", { receiverId })
        .getOne(),
    ]);

    if (!receiver) {
      this.logger.warn(
        {
          event: "notifications.friend_request",
          reason: "receiver_missing",
          receiverId,
        },
        "Receiver not found; cannot send friend request notification.",
      );
      return;
    }

    const tokens = this.extractExpoTokens(receiver.attributes);
    if (tokens.length === 0) {
      this.logger.debug(
        {
          event: "notifications.friend_request",
          reason: "no_tokens",
          receiverId,
        },
        "No Expo push tokens for receiver; skipping friend request notification.",
      );
      return;
    }

    const senderName = sender?.username || "A player";
    const title = this.settings.templates?.friendRequest?.title ||
      "New Friend Request";
    const bodyTemplate = this.settings.templates?.friendRequest?.body ||
      "{{sender}} sent you a friend request";
    const body = bodyTemplate.replace("{{sender}}", senderName);

    const messages: ExpoPushMessage[] = tokens.map((token) => ({
      to: token,
      sound: this.settings.defaults?.sound ?? "default",
      title,
      body,
      data: {
        type: "friend_request",
        senderId,
        receiverId,
      },
    }));

    if (messages.length === 0) {
      return;
    }

    return this.dispatch(messages);
  }

  private extractExpoTokens(
    attributes?: { key: string; value: unknown }[] | null,
  ): string[] {
    if (!attributes || attributes.length === 0) {
      return [];
    }

    const desiredKeys = this.settings.expo.tokenAttributes || [];
    const collected = attributes.reduce<string[]>((acc, attribute) => {
      if (!attribute?.key) {
        return acc;
      }

      if (desiredKeys.length > 0 && !desiredKeys.includes(attribute.key)) {
        return acc;
      }

      const tokens = this.deserializeTokens(attribute.value);
      if (tokens.length > 0) {
        acc.push(...tokens);
      }

      return acc;
    }, []);

    const uniqueTokens = Array.from(new Set(collected));
    const [validTokens, invalidTokens] = uniqueTokens.reduce<
      [string[], string[]]
    >(
      (result, token) => {
        if (Expo.isExpoPushToken(token)) {
          result[0].push(token);
        } else {
          result[1].push(token);
        }

        return result;
      },
      [[], []],
    );

    if (invalidTokens.length > 0) {
      this.logger.warn(
        {
          event: "notifications.invalid_token",
          count: invalidTokens.length,
          samples: invalidTokens.slice(0, 3).map((token) => token.slice(0, 15)),
        },
        "Ignoring invalid Expo push tokens.",
      );
    }

    return validTokens;
  }

  private deserializeTokens(raw: unknown): string[] {
    if (!raw) {
      return [];
    }

    if (Array.isArray(raw)) {
      return raw.map((value) => String(value)).filter(Boolean);
    }

    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.length === 0) {
        return [];
      }
      if (
        (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
        (trimmed.startsWith("{") && trimmed.endsWith("}"))
      ) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed.map((value) => String(value)).filter(Boolean);
          }
        } catch {
          // Fall through and treat as a plain token string
        }
      }
      return [trimmed];
    }

    return [String(raw)];
  }

  private async dispatch(
    messages: ExpoPushMessage[],
  ): Promise<ExpoPushTicket[]> {
    if (!this.expo) {
      return [];
    }

    const tickets: ExpoPushTicket[] = [];
    const chunks = this.expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
        this.logTicketErrors(ticketChunk);
      } catch (error) {
        this.logger.error(
          { err: error, event: "notifications.dispatch" },
          "Failed to send Expo push notification chunk.",
        );
      }
    }

    return tickets;
  }

  private logTicketErrors(tickets: ExpoPushTicket[]) {
    for (const ticket of tickets) {
      if (ticket.status === "error") {
        this.logger.error(
          {
            event: "notifications.dispatch",
            message: ticket.message,
            details: ticket.details,
          },
          "Expo push notification returned an error status.",
        );
      }
    }
  }
}

export type { NotificationsConfig };
