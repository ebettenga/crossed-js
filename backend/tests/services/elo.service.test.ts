import { EloService } from "../../src/services/EloService";
import { inflateDeviation, rate } from "../../src/services/glicko2";
import { Room } from "../../src/entities/Room";
import { User } from "../../src/entities/User";

type PlayerSeed = {
  id: number;
  eloRating: number;
  ratingDeviation?: number;
  ratingVolatility?: number;
  ratingUpdatedAt?: Date | null;
};

const NOW = new Date("2026-10-05T12:00:00Z");

const createService = (seeds: PlayerSeed[]) => {
  const users = new Map(
    seeds.map((seed) => [
      seed.id,
      Object.assign(new User(), {
        ratingDeviation: 500,
        ratingVolatility: 0.09,
        ratingUpdatedAt: null,
        ...seed,
      }),
    ]),
  );

  const userRepository = {
    findOne: jest.fn(async ({ where }: { where: { id: number } }) =>
      users.get(where.id) ?? null
    ),
    update: jest.fn(),
  };

  const service = new EloService(userRepository as any, {} as any, {} as any);
  return { service, userRepository };
};

const createRoom = (
  type: Room["type"],
  scores: Record<number, number>,
): Room =>
  Object.assign(new Room(), {
    id: 101,
    type,
    status: "finished" as Room["status"],
    players: Object.keys(scores).map((id) => ({ id: Number(id) }) as User),
    scores,
  });

const updateFor = (userRepository: { update: jest.Mock }, id: number) =>
  userRepository.update.mock.calls.find(([userId]) => userId === id)?.[1];

describe("glicko2", () => {
  const options = {
    tau: 0.5,
    minDeviation: 0,
    maxDeviation: 1000,
    maxVolatility: 1,
  };

  it("matches the worked example from Glickman's paper", () => {
    const player = { rating: 1500, deviation: 200, volatility: 0.06 };
    // The paper rates over one full period, so deviation grows by one first
    const updated = rate(
      { ...player, deviation: inflateDeviation(player, 1, options) },
      [
        { opponent: { rating: 1400, deviation: 30, volatility: 0.06 }, score: 1 },
        { opponent: { rating: 1550, deviation: 100, volatility: 0.06 }, score: 0 },
        { opponent: { rating: 1700, deviation: 300, volatility: 0.06 }, score: 0 },
      ],
      options,
    );

    expect(updated.rating).toBeCloseTo(1464.06, 1);
    expect(updated.deviation).toBeCloseTo(151.52, 1);
    expect(updated.volatility).toBeCloseTo(0.05999, 4);
  });

  it("grows deviation with inactivity, capped at the max", () => {
    const player = { rating: 1500, deviation: 60, volatility: 0.09 };
    const limits = { minDeviation: 45, maxDeviation: 500 };

    expect(inflateDeviation(player, 0, limits)).toBeCloseTo(60, 5);
    expect(inflateDeviation(player, 30 * 0.21436, limits)).toBeGreaterThan(70);
    expect(inflateDeviation(player, 1e6, limits)).toBe(500);
  });
});

describe("EloService", () => {
  it("swings established 1v1 players by roughly 10 points", async () => {
    const { service } = createService([
      { id: 1, eloRating: 1500, ratingDeviation: 60, ratingUpdatedAt: NOW },
      { id: 2, eloRating: 1500, ratingDeviation: 60, ratingUpdatedAt: NOW },
    ]);

    const ratings = await service.updateEloRatings(
      createRoom("1v1", { 1: 20, 2: 10 }),
      NOW,
    );

    const gain = ratings.get(1)! - 1500;
    const loss = 1500 - ratings.get(2)!;
    expect(gain).toBeGreaterThanOrEqual(8);
    expect(gain).toBeLessThanOrEqual(12);
    expect(loss).toBeGreaterThanOrEqual(8);
    expect(loss).toBeLessThanOrEqual(12);
  });

  it("moves new players quickly toward their strength", async () => {
    const { service } = createService([
      { id: 1, eloRating: 1200 },
      { id: 2, eloRating: 1200 },
    ]);

    const ratings = await service.updateEloRatings(
      createRoom("1v1", { 1: 20, 2: 10 }),
      NOW,
    );

    expect(ratings.get(1)! - 1200).toBeGreaterThan(150);
    expect(1200 - ratings.get(2)!).toBeGreaterThan(150);
  });

  it("barely moves an established player who loses to a new player", async () => {
    const { service } = createService([
      { id: 1, eloRating: 1500, ratingDeviation: 50, ratingUpdatedAt: NOW },
      { id: 2, eloRating: 1500 },
    ]);

    const ratings = await service.updateEloRatings(
      createRoom("1v1", { 1: 10, 2: 20 }),
      NOW,
    );

    expect(1500 - ratings.get(1)!).toBeLessThanOrEqual(5);
    expect(ratings.get(2)! - 1500).toBeGreaterThan(150);
  });

  it("costs the favorite more when losing to a lower-rated player", async () => {
    const { service } = createService([
      { id: 1, eloRating: 1700, ratingDeviation: 80, ratingUpdatedAt: NOW },
      { id: 2, eloRating: 1500, ratingDeviation: 80, ratingUpdatedAt: NOW },
    ]);

    const ratings = await service.updateEloRatings(
      createRoom("1v1", { 1: 10, 2: 20 }),
      NOW,
    );

    expect(1700 - ratings.get(1)!).toBeGreaterThan(15);
    expect(ratings.get(2)! - 1500).toBeGreaterThan(15);
  });

  it("leaves equal players unchanged on a draw but tightens deviation", async () => {
    const { service, userRepository } = createService([
      { id: 1, eloRating: 1500, ratingDeviation: 150, ratingUpdatedAt: NOW },
      { id: 2, eloRating: 1500, ratingDeviation: 150, ratingUpdatedAt: NOW },
    ]);

    const ratings = await service.updateEloRatings(
      createRoom("1v1", { 1: 15, 2: 15 }),
      NOW,
    );

    expect(ratings.get(1)).toBe(1500);
    expect(ratings.get(2)).toBe(1500);
    expect(updateFor(userRepository, 1).ratingDeviation).toBeLessThan(150);
  });

  it("rates free-for-all players against each opponent by finish order", async () => {
    const seeds = [1, 2, 3, 4].map((id) => ({
      id,
      eloRating: 1500,
      ratingDeviation: 80,
      ratingUpdatedAt: NOW,
    }));
    const { service } = createService(seeds);

    const ratings = await service.updateEloRatings(
      createRoom("free4all", { 1: 40, 2: 30, 3: 20, 4: 10 }),
      NOW,
    );

    expect(ratings.get(1)!).toBeGreaterThan(ratings.get(2)!);
    expect(ratings.get(2)!).toBeGreaterThan(ratings.get(3)!);
    expect(ratings.get(3)!).toBeGreaterThan(ratings.get(4)!);
    expect(ratings.get(1)!).toBeGreaterThan(1500);
    expect(ratings.get(4)!).toBeLessThan(1500);
  });

  it("never drops the top scorer's rating", async () => {
    const { service } = createService([
      { id: 1, eloRating: 1500, ratingDeviation: 60, ratingUpdatedAt: NOW },
      { id: 2, eloRating: 2200, ratingDeviation: 60, ratingUpdatedAt: NOW },
      { id: 3, eloRating: 2200, ratingDeviation: 60, ratingUpdatedAt: NOW },
      { id: 4, eloRating: 2200, ratingDeviation: 60, ratingUpdatedAt: NOW },
    ]);

    const ratings = await service.updateEloRatings(
      createRoom("2v2", { 1: 30, 2: 30, 3: 30, 4: 30 }),
      NOW,
    );

    for (const id of [1, 2, 3, 4]) {
      const before = id === 1 ? 1500 : 2200;
      expect(ratings.get(id)!).toBeGreaterThanOrEqual(before);
    }
  });

  it("swings more after a long break", async () => {
    const lastYear = new Date(NOW.getTime() - 365 * 24 * 60 * 60 * 1000);
    const play = async (ratingUpdatedAt: Date) => {
      const { service } = createService([
        { id: 1, eloRating: 1500, ratingDeviation: 60, ratingUpdatedAt },
        { id: 2, eloRating: 1500, ratingDeviation: 60, ratingUpdatedAt: NOW },
      ]);
      const ratings = await service.updateEloRatings(
        createRoom("1v1", { 1: 10, 2: 20 }),
        NOW,
      );
      return 1500 - ratings.get(1)!;
    };

    expect(await play(lastYear)).toBeGreaterThan(await play(NOW));
  });

  it("persists deviation, volatility and rating time", async () => {
    const { service, userRepository } = createService([
      { id: 1, eloRating: 1500 },
      { id: 2, eloRating: 1500 },
    ]);

    await service.updateEloRatings(createRoom("1v1", { 1: 20, 2: 10 }), NOW);

    expect(userRepository.update).toHaveBeenCalledTimes(2);
    const update = updateFor(userRepository, 1);
    expect(update.ratingDeviation).toBeLessThan(500);
    expect(update.ratingVolatility).toBeGreaterThan(0);
    expect(update.ratingUpdatedAt).toBe(NOW);
  });

  it("does not rate time trials", async () => {
    const { service, userRepository } = createService([
      { id: 1, eloRating: 1500 },
    ]);

    await expect(
      service.updateEloRatings(createRoom("time_trial", { 1: 20 }), NOW),
    ).rejects.toThrow("Invalid game type");
    expect(userRepository.update).not.toHaveBeenCalled();
  });
});
