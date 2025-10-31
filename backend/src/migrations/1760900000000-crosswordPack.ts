import { MigrationInterface, QueryRunner } from "typeorm";

export class CrosswordPack1760900000000 implements MigrationInterface {
  name = "CrosswordPack1760900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "crossword" ADD "pack" text NOT NULL DEFAULT 'general'`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_crossword_pack" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "pack" text NOT NULL, CONSTRAINT "PK_e8e597a3c1dbe5113373aeb9d5f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_crossword_pack" ADD CONSTRAINT "UQ_c3ad82b53a573fa80a203d3f0da" UNIQUE ("userId", "pack")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_crossword_pack" ADD CONSTRAINT "FK_702705489a243adfa5a12dd0dbf" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_crossword_pack" DROP CONSTRAINT "FK_702705489a243adfa5a12dd0dbf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_crossword_pack" DROP CONSTRAINT "UQ_c3ad82b53a573fa80a203d3f0da"`,
    );
    await queryRunner.query(`DROP TABLE "user_crossword_pack"`);
    await queryRunner.query(`ALTER TABLE "crossword" DROP COLUMN "pack"`);
  }
}
