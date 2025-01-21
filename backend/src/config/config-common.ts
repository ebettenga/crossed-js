export const commonConfig = {
  api: {
    prefix: '/api',
    port: 3000,
    host: '0.0.0.0',
  },
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  },
  game: {
    points: {
      correct: 3,
      incorrect: -1,
      forfeit: -300,
    },
    elo: {
      kFactorBase: 40,
      winStreakMultiplier: 0.3, // 30% increase per win streak
      maxWinStreakBonus: 0.5, // Maximum 50% increase from win streak
      gamesPlayedDampening: 100, // Multiplier for games played dampening
    },
    maxPlayers: {
      '1v1': 2,
      '2v2': 4,
      'free4all': 5,
    },
    crossword: {
      firstCrosswordDate: '2000-01-01',
    },
    timeout: {
      pending: 120000, // 2 minutes in milliseconds
      inactivity: {
        initial: 10000, // 10 seconds initial timeout
        minimum: 10000,  // 10 seconds minimum timeout
        // The rate at which the timeout decreases (percentage)
        // e.g., 0.2 means timeout reduces by 20% for each 10% of puzzle completed
        accelerationRate: 0.2,
        // Percentage of puzzle completion between timeout adjustments
        completionStep: 0.1, // 10%
      }
    },
  },
  status: {
    cleanup: {
      interval: 30000, // 30 seconds
      heartbeatTimeout: 300000, // 5 minutes
    }
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    from: process.env.SMTP_FROM || 'noreply@crossed.com',
  },
  mode: process.env.SERVER_MODE || 'api', // 'api' or 'worker',
};
