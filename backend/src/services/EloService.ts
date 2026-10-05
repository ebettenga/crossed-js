import { User } from "../entities/User";
import { Repository } from "typeorm";
import { config } from "../config/config";
import { Room } from "../entities/Room";
import { GameStats } from "../entities/GameStats";
import { Glicko2Rating, inflateDeviation, rate } from "./glicko2";

const RATED_GAME_TYPES = new Set(["1v1", "2v2", "free4all"]);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class EloService {
  private readonly settings = config.game.rating;

  constructor(
    private userRepository: Repository<User>,
    private roomRepository: Repository<Room>,
    private gameStatsRepository: Repository<GameStats>,
  ) {}

  async getUserGameStats(
    userId: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<GameStats[]> {
    const query = this.gameStatsRepository
      .createQueryBuilder("stats")
      .leftJoinAndSelect("stats.room", "room")
      .where("stats.userId = :userId", { userId })
      .andWhere("room.status = :status", { status: "finished" })
      .orderBy("stats.createdAt", "DESC");

    if (startDate) {
      query.andWhere("stats.createdAt >= :startDate", { startDate });
    }

    if (endDate) {
      query.andWhere("stats.createdAt <= :endDate", { endDate });
    }

    return query.getMany();
  }

  /**
   * Rate a finished game with Glicko-2. Every other player in the room counts
   * as one result (win/draw/loss by score), so 1v1, 2v2 and free-for-all all
   * share the same update.
   */
  async updateEloRatings(
    room: Room,
    now: Date = new Date(),
  ): Promise<Map<number, number>> {
    if (!RATED_GAME_TYPES.has(room.type)) {
      throw new Error("Invalid game type");
    }

    const players = await Promise.all(
      room.players.map((player) =>
        this.userRepository.findOne({
          where: { id: player.id },
          select: [
            "id",
            "eloRating",
            "ratingDeviation",
            "ratingVolatility",
            "ratingUpdatedAt",
          ],
        })
      ),
    );

    if (players.some((p) => !p)) {
      throw new Error("Some players not found");
    }

    const resolvedPlayers = players as User[];
    const scoreOf = (player: User) => room.scores[player.id] ?? 0;
    const maxScore = Math.max(...resolvedPlayers.map(scoreOf));

    const before = new Map<number, Glicko2Rating>(
      resolvedPlayers.map((player) => [player.id, this.currentRating(player, now)]),
    );

    const newRatings = new Map<number, number>();
    const updates: Promise<unknown>[] = [];

    for (const player of resolvedPlayers) {
      const results = resolvedPlayers
        .filter((opponent) => opponent.id !== player.id)
        .map((opponent) => ({
          opponent: before.get(opponent.id)!,
          score: scoreOf(player) > scoreOf(opponent)
            ? 1
            : scoreOf(player) === scoreOf(opponent)
            ? 0.5
            : 0,
        }));

      const updated = rate(before.get(player.id)!, results, this.settings);

      let eloRating = Math.max(
        this.settings.minRating,
        Math.round(updated.rating),
      );
      // Finishing on top of the room never costs rating
      if (scoreOf(player) === maxScore) {
        eloRating = Math.max(player.eloRating, eloRating);
      }

      newRatings.set(player.id, eloRating);
      updates.push(
        this.userRepository.update(player.id, {
          eloRating,
          ratingDeviation: updated.deviation,
          ratingVolatility: updated.volatility,
          ratingUpdatedAt: now,
        }),
      );
    }

    await Promise.all(updates);
    return newRatings;
  }

  private currentRating(player: User, now: Date): Glicko2Rating {
    const rating: Glicko2Rating = {
      rating: player.eloRating,
      deviation: player.ratingDeviation ?? this.settings.maxDeviation,
      volatility: player.ratingVolatility ?? 0.09,
    };
    if (!player.ratingUpdatedAt) return rating;

    const elapsedDays =
      (now.getTime() - new Date(player.ratingUpdatedAt).getTime()) / MS_PER_DAY;
    return {
      ...rating,
      deviation: inflateDeviation(
        rating,
        elapsedDays * this.settings.ratingPeriodsPerDay,
        this.settings,
      ),
    };
  }
}
