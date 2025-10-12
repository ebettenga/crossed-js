import { MigrationInterface, QueryRunner } from "typeorm";

export class JoinType1760283969861 implements MigrationInterface {
  name = "JoinType1760283969861";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."room_join_type_enum" AS ENUM('challenge', 'random', 'cli')`,
    );
    await queryRunner.query(
      `ALTER TABLE "room" ADD "join_type" "public"."room_join_type_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "room" DROP COLUMN "join_type"`);
    await queryRunner.query(`DROP TYPE "public"."room_join_type_enum"`);
  }
}
