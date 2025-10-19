import { EloService } from "../../src/services/EloService";
import { config } from "../../src/config/config";
import { GameStats } from "../../src/entities/GameStats";
import { Room } from "../../src/entities/Room";
import { User } from "../../src/entities/User";

type GamesPlayedMap = Record<number, number>;

const createQueryBuilderMock = (gamesPlayed: GamesPlayedMap) => {
  return () => {
    const qb: any = {
      __userId: undefined as number | undefined,
      innerJoin: jest.fn(() => qb),
      where: jest.fn(() => qb),
      andWhere: jest.fn((_condition: string, params?: { userId?: number }) => {
        if (params && typeof params.userId === "number") {
          qb.__userId = params.userId;
        }
        return qb;
      }),
      getCount: jest.fn(async () => {
        const id = qb.__userId ?? -1;
        return gamesPlayed[id] ?? 0;
      }),
    };

    return qb;
  };
};

const createService = (gamesPlayed: GamesPlayedMap = {}) => {
  const userRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const roomRepository = {
    createQueryBuilder: jest.fn(createQueryBuilderMock(gamesPlayed)),
  };

  const service = new EloService(
    userRepository as any,
    roomRepository as any,
    {} as any,
  );

  return { service, userRepository, roomRepository };
};

const expectedScore = (playerRating: number, opponentRating: number) =>
  1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));

const createEloTestScenario = () => {
  const roomId = 101;

  const rookie = Object.assign(new User(), {
    id: 1,
    username: "rookie_player",
    eloRating: 1200,
    gameStats: [] as GameStats[],
  });

  const veteran = Object.assign(new User(), {
    id: 2,
    username: "veteran_player",
    eloRating: 1200,
    gameStats: [] as GameStats[],
  });

  const room = Object.assign(new Room(), {
    id: roomId,
    type: "1v1" as Room["type"],
    status: "finished" as Room["status"],
    players: [
      { id: rookie.id } as User,
      { id: veteran.id } as User,
    ],
    scores: {
      [rookie.id]: 15,
      [veteran.id]: 10,
    },
  });

  return {
    room,
    rookie,
    veteran,
  };
};

const createFreeForAllScenario = () => {
  const roomId = 202;

  const leader = Object.assign(new User(), {
    id: 10,
    username: "ffa_leader",
    eloRating: 1400,
    gameStats: [] as GameStats[],
  });

  const chaser = Object.assign(new User(), {
    id: 11,
    username: "ffa_chaser",
    eloRating: 1300,
    gameStats: [] as GameStats[],
  });

  const challenger = Object.assign(new User(), {
    id: 12,
    username: "ffa_challenger",
    eloRating: 1200,
    gameStats: [] as GameStats[],
  });

  const room = Object.assign(new Room(), {
    id: roomId,
    type: "free4all" as Room["type"],
    status: "finished" as Room["status"],
    players: [
      { id: leader.id } as User,
      { id: chaser.id } as User,
      { id: challenger.id } as User,
    ],
    scores: {
      [leader.id]: 30,
      [chaser.id]: 20,
      [challenger.id]: 10,
    },
  });

  return {
    room,
    players: [leader, chaser, challenger] satisfies User[],
  };
};

describe("EloService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("applies rookie base K and veteran dampening through updateEloRatings", async () => {
    const { room, rookie, veteran } = createEloTestScenario();
    const { service, userRepository, roomRepository } = createService({
      [rookie.id]: 0,
      [veteran.id]: 100,
    });

    userRepository.findOne.mockImplementation(
      async ({ where: { id } }: { where: { id: number } }) => {
        if (id === rookie.id) return rookie;
        if (id === veteran.id) return veteran;
        return null;
      },
    );
    userRepository.update.mockResolvedValue({} as any);

    const result = await service.updateEloRatings(room);

    const baseK = config.game.elo.kFactorBase;
    const rookieExpected = expectedScore(rookie.eloRating, veteran.eloRating);
    const veteranExpected = expectedScore(veteran.eloRating, rookie.eloRating);
    const rookieRating = Math.max(
      rookie.eloRating,
      Math.round(rookie.eloRating + baseK * (1 - rookieExpected)),
    );
    const veteranK = baseK *
      Math.max(
        0.5,
        config.game.elo.gamesPlayedDampening /
          (100 + config.game.elo.gamesPlayedDampening),
      );
    const veteranRating = Math.round(
      veteran.eloRating + veteranK * (0 - veteranExpected),
    );

    expect(roomRepository.createQueryBuilder).toHaveBeenCalledTimes(2);
    expect(userRepository.update).toHaveBeenNthCalledWith(1, rookie.id, {
      eloRating: rookieRating,
    });
    expect(userRepository.update).toHaveBeenNthCalledWith(2, veteran.id, {
      eloRating: veteranRating,
    });
    expect(result.get(rookie.id)).toBe(rookieRating);
    expect(result.get(veteran.id)).toBe(veteranRating);
  });

  it("caps win streak bonus via updateEloRatings", async () => {
    const { room, rookie, veteran } = createEloTestScenario();
    const { service, userRepository } = createService({
      [rookie.id]: 0,
      [veteran.id]: 0,
    });

    const streakStats = Object.assign(new GameStats(), {
      roomId: room.id,
      winStreak: 10,
    });
    rookie.gameStats = [streakStats];
    veteran.gameStats = [];

    userRepository.findOne.mockImplementation(
      async ({ where: { id } }: { where: { id: number } }) => {
        if (id === rookie.id) return rookie;
        if (id === veteran.id) return veteran;
        return null;
      },
    );
    userRepository.update.mockResolvedValue({} as any);

    const result = await service.updateEloRatings(room);

    const baseK = config.game.elo.kFactorBase;
    const expected = expectedScore(rookie.eloRating, veteran.eloRating);
    const cappedBonus = 1 + config.game.elo.maxWinStreakBonus;
    const rookieRating = Math.max(
      rookie.eloRating,
      Math.round(rookie.eloRating + baseK * cappedBonus * (1 - expected)),
    );

    expect(userRepository.update).toHaveBeenCalledWith(rookie.id, {
      eloRating: rookieRating,
    });
    expect(result.get(rookie.id)).toBe(rookieRating);
  });

  it("treats 1v1 draws as neutral outcomes", async () => {
    const { room, rookie, veteran } = createEloTestScenario();
    room.scores = {
      [rookie.id]: 15,
      [veteran.id]: 15,
    };

    const { service, userRepository, roomRepository } = createService({
      [rookie.id]: 25,
      [veteran.id]: 40,
    });

    userRepository.findOne.mockImplementation(
      async ({ where: { id } }: { where: { id: number } }) => {
        if (id === rookie.id) return rookie;
        if (id === veteran.id) return veteran;
        return null;
      },
    );
    userRepository.update.mockResolvedValue({} as any);

    const result = await service.updateEloRatings(room);

    expect(roomRepository.createQueryBuilder).toHaveBeenCalledTimes(2);
    expect(userRepository.update).toHaveBeenNthCalledWith(1, rookie.id, {
      eloRating: rookie.eloRating,
    });
    expect(userRepository.update).toHaveBeenNthCalledWith(2, veteran.id, {
      eloRating: veteran.eloRating,
    });
    expect(result.get(rookie.id)).toBe(rookie.eloRating);
    expect(result.get(veteran.id)).toBe(veteran.eloRating);
  });

  it("updates free-for-all ratings with dampening and protects winners", async () => {
    const { room, players } = createFreeForAllScenario();
    const [leader, chaser, challenger] = players;

    const { service, userRepository, roomRepository } = createService({
      [leader.id]: 0,
      [chaser.id]: 80,
      [challenger.id]: 80,
    });

    userRepository.findOne.mockImplementation(
      async ({ where: { id } }: { where: { id: number } }) => {
        return players.find((player) => player.id === id) ?? null;
      },
    );
    userRepository.update.mockResolvedValue({} as any);

    const result = await service.updateEloRatings(room);

    const baseK = config.game.elo.kFactorBase;
    const leaderExpected = (
      expectedScore(leader.eloRating, chaser.eloRating) +
      expectedScore(leader.eloRating, challenger.eloRating)
    ) / 2;
    const leaderActual = 1;
    const leaderRating = Math.round(
      leader.eloRating + baseK * (leaderActual - leaderExpected),
    );

    const veteranK = baseK *
      Math.max(
        0.5,
        config.game.elo.gamesPlayedDampening /
          (80 + config.game.elo.gamesPlayedDampening),
      );
    const chaserExpected = (
      expectedScore(chaser.eloRating, leader.eloRating) +
      expectedScore(chaser.eloRating, challenger.eloRating)
    ) / 2;
    const challengerExpected = (
      expectedScore(challenger.eloRating, leader.eloRating) +
      expectedScore(challenger.eloRating, chaser.eloRating)
    ) / 2;

    const chaserRating = Math.round(
      chaser.eloRating + veteranK * (0.5 - chaserExpected),
    );
    const challengerRating = Math.round(
      challenger.eloRating + veteranK * (0 - challengerExpected),
    );

    expect(roomRepository.createQueryBuilder).toHaveBeenCalledTimes(3);
    expect(userRepository.update).toHaveBeenNthCalledWith(1, leader.id, {
      eloRating: Math.max(leader.eloRating, leaderRating),
    });
    expect(userRepository.update).toHaveBeenNthCalledWith(2, chaser.id, {
      eloRating: chaserRating,
    });
    expect(userRepository.update).toHaveBeenNthCalledWith(3, challenger.id, {
      eloRating: challengerRating,
    });

    expect(result.get(leader.id)).toBe(Math.max(leader.eloRating, leaderRating));
    expect(result.get(chaser.id)).toBe(chaserRating);
    expect(result.get(challenger.id)).toBe(challengerRating);
  });
});
