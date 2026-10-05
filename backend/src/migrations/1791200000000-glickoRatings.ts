import { MigrationInterface, QueryRunner } from "typeorm";

export class GlickoRatings1791200000000 implements MigrationInterface {
  name = "GlickoRatings1791200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "ratingDeviation" double precision NOT NULL DEFAULT '500'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "ratingVolatility" double precision NOT NULL DEFAULT '0.09'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "ratingUpdatedAt" TIMESTAMP`,
    );
    // Existing players keep their rating but start with a deviation that
    // shrinks with experience, so veterans don't swing like brand-new players.
    await queryRunner.query(`
      UPDATE "user" u
      SET "ratingDeviation" = GREATEST(110, 350 - 20 * played.count),
          "ratingUpdatedAt" = now()
      FROM (
        SELECT rp.user_id, COUNT(*) AS count
        FROM room_players rp
        JOIN room r ON r.id = rp.room_id
        WHERE r.status = 'finished' AND r.type <> 'time_trial'
        GROUP BY rp.user_id
      ) played
      WHERE played.user_id = u.id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "ratingUpdatedAt"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "ratingVolatility"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "ratingDeviation"`);
  }
}
