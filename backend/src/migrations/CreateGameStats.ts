import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateGameStats1710000000001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
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

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "game_stats"`);
    }
} 