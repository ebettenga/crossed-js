import { User } from "../entities/User";
import { Repository } from "typeorm";
import { config } from "../config/config";
import { Room } from "../entities/Room";
import { GameStats } from "../entities/GameStats";

export class EloService {
    private readonly K_FACTOR_BASE = config.game.elo.kFactorBase;
    private readonly WIN_STREAK_MULTIPLIER = config.game.elo.winStreakMultiplier;
    private readonly MAX_WIN_STREAK_BONUS = config.game.elo.maxWinStreakBonus;
    private readonly GAMES_PLAYED_DAMPENING = config.game.elo.gamesPlayedDampening;

    constructor(
    private userRepository: Repository<User>,
    private roomRepository: Repository<Room>,
    private gameStatsRepository: Repository<GameStats>
  ) {}

    /**
     * Calculate the expected score (probability of winning)
     */
    private calculateExpectedScore(playerRating: number, opponentRating: number): number {
        return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    }

    /**
     * Get the number of games played by a user
     */
    private async getGamesPlayed(userId: number): Promise<number> {
        const count = await this.roomRepository.createQueryBuilder('room')
            .innerJoin('room_players', 'rp', 'rp.room_id = room.id')
            .where('room.status = :status', { status: 'finished' })
            .andWhere('rp.user_id = :userId', { userId })
            .getCount();
        return count;
    }

    /**
     * Calculate the K-factor based on games played and win streak
     */
    private async calculateKFactor(stats: GameStats | undefined, userId: number): Promise<number> {
        const gamesPlayed = await this.getGamesPlayed(userId);
        const winStreak = stats?.winStreak || 0;

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
     * Calculate team rating by averaging member ratings
     */
    private calculateTeamRating(teamMembers: User[]): number {
        return teamMembers.reduce((sum, player) => sum + player.eloRating, 0) / teamMembers.length;
    }

    private getStatsForRoom(player: User, roomId: number): GameStats | undefined {
        if (!player.gameStats || player.gameStats.length === 0) {
            return undefined;
        }

        const currentGameStats = player.gameStats.find(stat => stat.roomId === roomId);
        if (currentGameStats) {
            return currentGameStats;
        }

        let latestStats: GameStats | undefined;

        for (const stat of player.gameStats) {
            if (!latestStats) {
                latestStats = stat;
                continue;
            }

            if (stat.createdAt && latestStats.createdAt) {
                if (stat.createdAt > latestStats.createdAt) {
                    latestStats = stat;
                }
            } else if (stat.createdAt && !latestStats.createdAt) {
                latestStats = stat;
            }
        }

        return latestStats;
    }

    async getUserGameStats(userId: number, startDate?: Date, endDate?: Date): Promise<GameStats[]> {
        const query = this.gameStatsRepository
            .createQueryBuilder('stats')
            .leftJoinAndSelect('stats.room', 'room')
            .where('stats.userId = :userId', { userId })
            .andWhere('room.status = :status', { status: 'finished' })
            .orderBy('stats.createdAt', 'DESC');

        if (startDate) {
            query.andWhere('stats.createdAt >= :startDate', { startDate });
        }

        if (endDate) {
            query.andWhere('stats.createdAt <= :endDate', { endDate });
        }

        return query.getMany();
    }


    /**
     * Update ELO ratings for a finished game room
     */
    async updateEloRatings(room: Room): Promise<Map<number, number>> {
        const players = await Promise.all(
            room.players.map(player =>
                this.userRepository.findOne({
                    where: { id: player.id },
                    select: ['id', 'eloRating'],
                    relations: ['gameStats']
                })
            )
        );

        if (players.some(p => !p)) {
            throw new Error('Some players not found');
        }

        // Get winners based on highest score
        const maxScore = Math.max(...Object.values(room.scores));
        const winners = players.filter(p => room.scores[p.id] === maxScore);
        const losers = players.filter(p => room.scores[p.id] < maxScore);

        const newRatings = new Map<number, number>();

        switch (room.type) {
            case '1v1':
                return this.update1v1Ratings(room, winners[0], losers[0]);
            case '2v2':
                return this.update2v2Ratings(room, winners, losers);
            case 'free4all':
                return this.updateFreeForAllRatings(room, players);
            default:
                throw new Error('Invalid game type');
        }
    }

    /**
     * Update ratings for 1v1 games
     */
    private async update1v1Ratings(room: Room, winner: User, loser: User): Promise<Map<number, number>> {
        const expectedWinnerScore = this.calculateExpectedScore(winner.eloRating, loser.eloRating);
        const expectedLoserScore = this.calculateExpectedScore(loser.eloRating, winner.eloRating);

        const winnerStats = this.getStatsForRoom(winner, room.id);
        const loserStats = this.getStatsForRoom(loser, room.id);

        const [winnerK, loserK] = await Promise.all([
            this.calculateKFactor(winnerStats, winner.id),
            this.calculateKFactor(loserStats, loser.id)
        ]);

        const winnerNewRating = Math.round(
            winner.eloRating + winnerK * (1 - expectedWinnerScore)
        );
        const loserNewRating = Math.round(
            loser.eloRating + loserK * (0 - expectedLoserScore)
        );

        await Promise.all([
            this.userRepository.update(winner.id, { eloRating: winnerNewRating }),
            this.userRepository.update(loser.id, { eloRating: loserNewRating })
        ]);

        return new Map([
            [winner.id, winnerNewRating],
            [loser.id, loserNewRating]
        ]);
    }

    /**
     * Update ratings for 2v2 team games
     */
    private async update2v2Ratings(room: Room, winners: User[], losers: User[]): Promise<Map<number, number>> {
        // Split players into teams based on their scores
        const team1 = winners;
        const team2 = losers;

        const team1Rating = this.calculateTeamRating(team1);
        const team2Rating = this.calculateTeamRating(team2);

        const expectedTeam1Score = this.calculateExpectedScore(team1Rating, team2Rating);
        const expectedTeam2Score = this.calculateExpectedScore(team2Rating, team1Rating);

        const newRatings = new Map<number, number>();

        // Update ratings for team 1 (winners)
        for (const player of team1) {
            const stats = this.getStatsForRoom(player, room.id);
            const kFactor = await this.calculateKFactor(stats, player.id);
            const newRating = Math.round(
                player.eloRating + kFactor * (1 - expectedTeam1Score)
            );
            newRatings.set(player.id, newRating);
        }

        // Update ratings for team 2 (losers)
        for (const player of team2) {
            const stats = this.getStatsForRoom(player, room.id);
            const kFactor = await this.calculateKFactor(stats, player.id);
            const newRating = Math.round(
                player.eloRating + kFactor * (0 - expectedTeam2Score)
            );
            newRatings.set(player.id, newRating);
        }

        // Save all new ratings
        await Promise.all(
            Array.from(newRatings.entries()).map(([playerId, rating]) =>
                this.userRepository.update(playerId, { eloRating: rating })
            )
        );

        return newRatings;
    }

    /**
     * Update ratings for free-for-all games using a modified multi-player ELO system
     */
    private async updateFreeForAllRatings(room: Room, players: User[]): Promise<Map<number, number>> {
        const newRatings = new Map<number, number>();

        // Sort players by score in descending order
        const sortedPlayers = [...players].sort(
            (a, b) => room.scores[b.id] - room.scores[a.id]
        );

        // Calculate expected scores for each player against every other player
        for (let i = 0; i < sortedPlayers.length; i++) {
            const player = sortedPlayers[i];
            let expectedScore = 0;
            let actualScore = 0;

            // Calculate expected and actual scores against each opponent
            for (let j = 0; j < sortedPlayers.length; j++) {
                if (i === j) continue;

                const opponent = sortedPlayers[j];
                expectedScore += this.calculateExpectedScore(player.eloRating, opponent.eloRating);

                // Actual score is 1 if player scored higher, 0.5 if tied, 0 if lower
                if (room.scores[player.id] > room.scores[opponent.id]) {
                    actualScore += 1;
                } else if (room.scores[player.id] === room.scores[opponent.id]) {
                    actualScore += 0.5;
                }
            }

            // Normalize scores by number of opponents
            const normalizedExpectedScore = expectedScore / (sortedPlayers.length - 1);
            const normalizedActualScore = actualScore / (sortedPlayers.length - 1);

            // Calculate new rating
            const stats = this.getStatsForRoom(player, room.id);
            const kFactor = await this.calculateKFactor(stats, player.id);

            const newRating = Math.round(
                player.eloRating + kFactor * (normalizedActualScore - normalizedExpectedScore)
            );
            newRatings.set(player.id, newRating);
        }

        // Save all new ratings
        await Promise.all(
            Array.from(newRatings.entries()).map(([playerId, rating]) =>
                this.userRepository.update(playerId, { eloRating: rating })
            )
        );

        return newRatings;
    }
}
