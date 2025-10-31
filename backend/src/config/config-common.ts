import { RedisOptions } from "ioredis";

const redisURL = process.env.REDIS_URL ? new URL(process.env.REDIS_URL) : null;

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
    },
    timeout: {
      pending: 60000, // 1 minutes in milliseconds
      inactivity: {
        initial: 5000, // 2 seconds initial timeout
        minimum: 5000, // 2 seconds minimum timeout
        // The rate at which the timeout decreases (percentage)
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
};
