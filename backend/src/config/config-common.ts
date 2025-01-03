export const commonConfig = {
  api: {
    prefix: '/api',
    port: 3000,
    host: 'localhost',
  },
  game: {
    points: {
      correct: 3,
      incorrect: -1,
    },
    elo: {
      kFactorBase: 32,
      winStreakMultiplier: 0.1, // 10% increase per win streak
      maxWinStreakBonus: 0.5, // Maximum 50% increase from win streak
      gamesPlayedDampening: 30, // Number of games before dampening starts
    },
    maxPlayers: {
      '1v1': 2,
      '2v2': 4,
      'free4all': 5,
    }
  }
};
