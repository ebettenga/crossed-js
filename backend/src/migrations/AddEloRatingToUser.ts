import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEloRatingToUser1710000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "user" ADD COLUMN "eloRating" integer NOT NULL DEFAULT 1200`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "eloRating"`);
    }
} 