import { RedisOptions } from "ioredis";

const redisURL = process.env.REDIS_URL ? new URL(process.env.REDIS_URL) : null;
const notificationTokenKeys = process.env.EXPO_NOTIFICATIONS_TOKEN_KEYS
  ? process.env.EXPO_NOTIFICATIONS_TOKEN_KEYS.split(",")
    .map((key) => key.trim())
    .filter(Boolean)
  : ["expoPushToken"];

export const commonConfig = {
  api: {
    prefix: "/api",
    port: 3000,
    host: "0.0.0.0",
  },
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
  game: {
    points: {
      correct: 3,
      incorrect: -1,
      forfeit: -300,
    },
    elo: {
      kFactorBase: 25,
      winStreakMultiplier: 0.1,
      maxWinStreakBonus: 0.3,
      gamesPlayedDampening: 30,
    },
    maxPlayers: {
      "1v1": 2,
      "2v2": 4,
      "free4all": 4,
      "time_trial": 1,
    },
    crossword: {
      firstCrosswordDate: "2000-01-01",
      source: process.env.CROSSWORDS_SOURCE ||
        "https://github.com/ebettenga/crossed-js/tree/main/crosswords",
    },
    timeout: {
      pending: 60000, // 1 minutes in milliseconds
      autoReveal: {
        initial: 5000, // Initial delay before the auto-reveal system kicks in
        minimum: 5000, // Floor for how fast auto-reveal can tick
        // The rate at which the delay decreases (percentage)
        // e.g., 0.2 means timeout reduces by 20% for each 10% of puzzle completed
        accelerationRate: 0.2,
        // Percentage of puzzle completion between timeout adjustments
        completionStep: 0.1, // 10%
      },
    },
  },
  status: {
    cleanup: {
      interval: 30000, // 30 seconds
      heartbeatTimeout: 300000, // 5 minutes
    },
  },
  redis: {
    default: {
      family: 0,
      host: redisURL?.hostname || "localhost",
      port: parseInt(redisURL?.port || "6379"),
      username: redisURL?.username || "default",
      password: redisURL?.password || "",
    } as RedisOptions,
    gameTTL: 86400, // 1 day in seconds
    responseCacheTTL: parseInt(process.env.RESPONSE_CACHE_TTL || "15", 10),
  },
  email: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    from: process.env.SMTP_FROM || "noreply@crossed.com",
  },
  mode: process.env.SERVER_MODE || "api", // 'api' or 'worker',
  notifications: {
    expo: {
      enabled: process.env.EXPO_NOTIFICATIONS_ENABLED === "true",
      accessToken: process.env.EXPO_ACCESS_TOKEN,
      useFcmV1: process.env.EXPO_USE_FCM_V1 !== "false",
      tokenAttributes: notificationTokenKeys,
    },
    defaults: {
      sound: process.env.EXPO_NOTIFICATIONS_SOUND || "default",
    },
    templates: {
      friendRequest: {
        title: "New Friend Request",
        body: "{{sender}} sent you a friend request",
      },
      challengeReceived: {
        title: "New Challenge",
        body: "{{challenger}} challenged you to a {{difficulty}} match",
      },
    },
  },
};
