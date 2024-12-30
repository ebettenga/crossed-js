import { ViewEntity, ViewColumn, OneToOne, JoinColumn } from "typeorm";
import { User } from "./User";

@ViewEntity({
    expression: `
        WITH user_games AS (
            SELECT 
                CASE 
                    WHEN player_1_id = u.id THEN player_1_score > player_2_score
                    WHEN player_2_id = u.id THEN player_2_score > player_1_score
                END as is_winner,
                r.created_at,
                u.id as "user_id"
            FROM "user" u
            CROSS JOIN LATERAL (
                SELECT 
                    player_1_id,
                    player_2_id,
                    player_1_score,
                    player_2_score,
                    created_at
                FROM room r
                WHERE r.player_1_id = u.id OR r.player_2_id = u.id
                ORDER BY r.created_at DESC
            ) r
        ),
        win_streaks AS (
            SELECT 
                "user_id",
                COUNT(*) as win_streak
            FROM (
                SELECT 
                    "user_id",
                    is_winner,
                    SUM(CASE WHEN is_winner = false OR is_winner IS NULL THEN 1 ELSE 0 END) 
                    OVER (ORDER BY created_at DESC) as grp
                FROM user_games
            ) s
            WHERE is_winner = true
            GROUP BY "user_id", grp
            ORDER BY win_streak DESC
            LIMIT 1
        )
        SELECT 
            u.id,
            u.id as "user_id",
            COALESCE(
                (SELECT COUNT(*) 
                FROM room r 
                WHERE r.player_1_id = u.id OR r.player_2_id = u.id
                ), 0
            ) as "games_played",
            COALESCE(ws.win_streak, 0) as "win_streak",
            COALESCE(
                (SELECT COUNT(*) 
                FROM room r 
                WHERE (r.player_1_id = u.id AND r.player_1_score > r.player_2_score) 
                   OR (r.player_2_id = u.id AND r.player_2_score > r.player_1_score)
                ), 0
            ) as "total_wins",
            COALESCE(
                (SELECT COUNT(*) 
                FROM room r 
                WHERE (r.player_1_id = u.id AND r.player_1_score < r.player_2_score) 
                   OR (r.player_2_id = u.id AND r.player_2_score < r.player_1_score)
                ), 0
            ) as "total_losses"
        FROM "user" u
        LEFT JOIN win_streaks ws ON ws."user_id" = u.id
    `
})
export class GameStats {
    @ViewColumn()
    id: number;

    @ViewColumn()
    user_id: number;

    @OneToOne(() => User)
    @JoinColumn({ name: "user_id" })
    user: User;

    @ViewColumn()
    games_played: number;

    @ViewColumn()
    win_streak: number;

    @ViewColumn()
    total_wins: number;

    @ViewColumn()
    total_losses: number;
} 