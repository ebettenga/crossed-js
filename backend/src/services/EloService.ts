import { User } from "../entities/User";
import { Repository } from "typeorm";
import { config } from "../config/config";

export class EloService {
    private readonly K_FACTOR_BASE = config.game.elo.kFactorBase;
    private readonly WIN_STREAK_MULTIPLIER = config.game.elo.winStreakMultiplier;
    private readonly MAX_WIN_STREAK_BONUS = config.game.elo.maxWinStreakBonus;
    private readonly GAMES_PLAYED_DAMPENING = config.game.elo.gamesPlayedDampening;

    constructor(private userRepository: Repository<User>) {}

    /**
     * Calculate the expected score (probability of winning)
     */
    private calculateExpectedScore(playerRating: number, opponentRating: number): number {
        return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    }

    /**
     * Calculate the K-factor based on games played and win streak
     */
    private calculateKFactor(gamesPlayed: number, winStreak: number): number {
        // Dampen K-factor based on games played
        const gamesDampening = Math.max(1, this.GAMES_PLAYED_DAMPENING / Math.max(1, gamesPlayed));
        
        // Calculate win streak bonus (capped at MAX_WIN_STREAK_BONUS)
        const winStreakBonus = Math.min(
            this.MAX_WIN_STREAK_BONUS,
            winStreak * this.WIN_STREAK_MULTIPLIER
        );

        return this.K_FACTOR_BASE * gamesDampening * (1 + winStreakBonus);
    }

    /**
     * Update ELO ratings for two players after a game
     */
    async updateEloRatings(
        winnerId: number,
        loserId: number
    ): Promise<{ winnerNewRating: number; loserNewRating: number }> {
        const [winner, loser] = await Promise.all([
            this.userRepository.findOne({
                where: { id: winnerId },
                select: ['id', 'eloRating'],
                relations: ['gameStats']
            }),
            this.userRepository.findOne({
                where: { id: loserId },
                select: ['id', 'eloRating'],
                relations: ['gameStats']
            })
        ]);

        if (!winner || !loser) {
            throw new Error('Players not found');
        }

        const expectedWinnerScore = this.calculateExpectedScore(winner.eloRating, loser.eloRating);
        const expectedLoserScore = this.calculateExpectedScore(loser.eloRating, winner.eloRating);

        // Get games played and win streak from gameStats
        const winnerStats = winner.gameStats;
        const loserStats = loser.gameStats;

        // Calculate K-factors
        const winnerK = this.calculateKFactor(winnerStats.games_played, winnerStats.win_streak);
        const loserK = this.calculateKFactor(loserStats.games_played, loserStats.win_streak);

        // Calculate new ratings
        const winnerNewRating = Math.round(
            winner.eloRating + winnerK * (1 - expectedWinnerScore)
        );
        const loserNewRating = Math.round(
            loser.eloRating + loserK * (0 - expectedLoserScore)
        );

        // Update ratings in database
        await Promise.all([
            this.userRepository.update(winnerId, { eloRating: winnerNewRating }),
            this.userRepository.update(loserId, { eloRating: loserNewRating })
        ]);

        return {
            winnerNewRating,
            loserNewRating
        };
    }
} 