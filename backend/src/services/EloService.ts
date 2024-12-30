import { User } from "../entities/User";
import { Repository } from "typeorm";

export class EloService {
    private readonly K_FACTOR_BASE = 32;
    private readonly WIN_STREAK_MULTIPLIER = 0.1; // 10% increase per win streak
    private readonly MAX_WIN_STREAK_BONUS = 0.5; // Maximum 50% increase from win streak
    private readonly GAMES_PLAYED_DAMPENING = 30; // Number of games before dampening starts

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
        const winnerStats = winner.gameStats || { gamesPlayed: 0, winStreak: 0 };
        const loserStats = loser.gameStats || { gamesPlayed: 0, winStreak: 0 };

        // Calculate K-factors
        const winnerK = this.calculateKFactor(winnerStats.gamesPlayed, winnerStats.winStreak);
        const loserK = this.calculateKFactor(loserStats.gamesPlayed, loserStats.winStreak);

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