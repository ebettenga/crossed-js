import { MigrationInterface, QueryRunner } from "typeorm";

export class RoomChallenger1791300000000 implements MigrationInterface {
  name = "RoomChallenger1791300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "room" ADD "challenger_id" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "room" DROP COLUMN "challenger_id"`);
  }
}
