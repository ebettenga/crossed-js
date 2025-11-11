import { MigrationInterface, QueryRunner } from "typeorm";

export class TimeTrialLeaderboard1762839005000
  implements MigrationInterface
{
  name = "TimeTrialLeaderboard1762839005000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "time_trial_leaderboard_entry" ("id" SERIAL NOT NULL, "roomId" integer NOT NULL, "score" integer NOT NULL, "timeTakenMs" integer, "roomCompletedAt" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "crosswordId" integer NOT NULL, "userId" integer NOT NULL, CONSTRAINT "UQ_time_trial_leaderboard_crossword_user" UNIQUE ("crosswordId", "userId"), CONSTRAINT "PK_time_trial_leaderboard_entry" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "time_trial_leaderboard_entry" ADD CONSTRAINT "FK_time_trial_leaderboard_crossword" FOREIGN KEY ("crosswordId") REFERENCES "crossword"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "time_trial_leaderboard_entry" ADD CONSTRAINT "FK_time_trial_leaderboard_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "time_trial_leaderboard_entry" DROP CONSTRAINT "FK_time_trial_leaderboard_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "time_trial_leaderboard_entry" DROP CONSTRAINT "FK_time_trial_leaderboard_crossword"`,
    );
    await queryRunner.query(`DROP TABLE "time_trial_leaderboard_entry"`);
  }
}
