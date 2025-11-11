import { MigrationInterface, QueryRunner } from "typeorm";

export class RoomIndexes1762844790671 implements MigrationInterface {
  name = "RoomIndexes1762844790671";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_crossword_pack" DROP CONSTRAINT "FK_702705489a243adfa5a12dd0dbf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_crossword_pack" DROP CONSTRAINT "UQ_c3ad82b53a573fa80a203d3f0da"`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_room_type" ON "room" ("type") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_room_status" ON "room" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_room_last_activity_at" ON "room" ("last_activity_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_room_status_type_last_activity_at" ON "room" ("status", "type", "last_activity_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user_crossword_pack" ADD CONSTRAINT "UQ_7f113079d2017b69fa4fa3c3e5c" UNIQUE ("userId", "pack")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_crossword_pack" ADD CONSTRAINT "FK_2b7ddd083e0e9e02e920ca1dc79" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_crossword_pack" DROP CONSTRAINT "FK_2b7ddd083e0e9e02e920ca1dc79"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_crossword_pack" DROP CONSTRAINT "UQ_7f113079d2017b69fa4fa3c3e5c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_room_status_type_last_activity_at"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_room_last_activity_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_room_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_room_type"`);
    await queryRunner.query(
      `ALTER TABLE "user_crossword_pack" ADD CONSTRAINT "UQ_c3ad82b53a573fa80a203d3f0da" UNIQUE ("userId", "pack")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_crossword_pack" ADD CONSTRAINT "FK_702705489a243adfa5a12dd0dbf" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
