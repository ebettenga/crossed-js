import { MigrationInterface, QueryRunner } from "typeorm";

export class RoomIndexes1761210000000 implements MigrationInterface {
  name = "RoomIndexes1761210000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_room_status" ON "room" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_room_type" ON "room" ("type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_room_last_activity_at" ON "room" ("last_activity_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_room_status_type_last_activity_at" ON "room" ("status", "type", "last_activity_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_room_status_type_last_activity_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_room_last_activity_at"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_room_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_room_status"`);
  }
}
