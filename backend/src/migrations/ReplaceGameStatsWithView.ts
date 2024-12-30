import { MigrationInterface, QueryRunner } from "typeorm";

export class ReplaceGameStatsWithView1710000000002 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the existing table if it exists
        await queryRunner.query(`DROP TABLE IF EXISTS "game_stats"`);

        // Create the view
        await queryRunner.query(`
            CREATE VIEW "game_stats" AS
            WITH user_games AS (
                SELECT 
                    CASE 
                        WHEN player_1_id = u.id THEN player_1_score > player_2_score
                        WHEN player_2_id = u.id THEN player_2_score > player_1_score
                    END as is_winner,
                    r.created_at,
                    u.id as "userId"
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
                    "userId",
                    COUNT(*) as win_streak
                FROM (
                    SELECT 
                        "userId",
                        is_winner,
                        SUM(CASE WHEN is_winner = false OR is_winner IS NULL THEN 1 ELSE 0 END) 
                        OVER (ORDER BY created_at DESC) as grp
                    FROM user_games
                ) s
                WHERE is_winner = true
                GROUP BY "userId", grp
                ORDER BY win_streak DESC
                LIMIT 1
            )
            SELECT 
                u.id,
                u.id as "userId",
                COALESCE(
                    (SELECT COUNT(*) 
                    FROM room r 
                    WHERE r.player_1_id = u.id OR r.player_2_id = u.id
                    ), 0
                ) as "gamesPlayed",
                COALESCE(ws.win_streak, 0) as "winStreak",
                COALESCE(
                    (SELECT COUNT(*) 
                    FROM room r 
                    WHERE (r.player_1_id = u.id AND r.player_1_score > r.player_2_score) 
                       OR (r.player_2_id = u.id AND r.player_2_score > r.player_1_score)
                    ), 0
                ) as "totalWins",
                COALESCE(
                    (SELECT COUNT(*) 
                    FROM room r 
                    WHERE (r.player_1_id = u.id AND r.player_1_score < r.player_2_score) 
                       OR (r.player_2_id = u.id AND r.player_2_score < r.player_1_score)
                    ), 0
                ) as "totalLosses"
            FROM "user" u
            LEFT JOIN win_streaks ws ON ws."userId" = u.id
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS "game_stats"`);
        
        // Recreate the original table
        await queryRunner.query(`
            CREATE TABLE "game_stats" (
                "id" SERIAL PRIMARY KEY,
                "userId" integer UNIQUE REFERENCES "user"(id),
                "gamesPlayed" integer NOT NULL DEFAULT 0,
                "winStreak" integer NOT NULL DEFAULT 0,
                "totalWins" integer NOT NULL DEFAULT 0,
                "totalLosses" integer NOT NULL DEFAULT 0
            )
        `);
    }
} 