import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1760114015445 implements MigrationInterface {
  name = "Init1760114015445";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."support_type_enum" AS ENUM('support', 'suggestion')`,
    );
    await queryRunner.query(
      `CREATE TABLE "support" ("id" SERIAL NOT NULL, "type" "public"."support_type_enum" NOT NULL, "comment" text NOT NULL, "userId" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_54c6021e6f6912eaaee36b3045d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_status_enum" AS ENUM('online', 'offline')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" SERIAL NOT NULL, "username" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "lastActiveAt" TIMESTAMP NOT NULL DEFAULT now(), "email" text NOT NULL, "password" text NOT NULL, "confirmed_mail" boolean NOT NULL DEFAULT false, "roles" text NOT NULL DEFAULT '["user"]', "description" text, "photo" bytea, "photoContentType" text, "status" "public"."user_status_enum" NOT NULL DEFAULT 'offline', "attributes" text, "eloRating" integer NOT NULL DEFAULT '1200', CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "crossword" ("id" SERIAL NOT NULL, "clues" jsonb NOT NULL, "answers" jsonb NOT NULL, "author" text, "created_by" text, "creator_link" text, "circles" text, "date" date, "dow" text, "grid" text, "gridnums" text, "shadecircles" boolean, "col_size" integer, "row_size" integer, "jnote" text, "notepad" text, "title" text, CONSTRAINT "PK_b3bdd474534ec7c74704d0f43c8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."room_type_enum" AS ENUM('1v1', '2v2', 'free4all', 'time_trial')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."room_status_enum" AS ENUM('playing', 'pending', 'finished', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "room" ("id" SERIAL NOT NULL, "type" "public"."room_type_enum" NOT NULL DEFAULT '1v1', "status" "public"."room_status_enum" NOT NULL DEFAULT 'pending', "scores" text NOT NULL DEFAULT '{}', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "completed_at" TIMESTAMP, "difficulty" text NOT NULL, "found_letters" character array NOT NULL DEFAULT '{}', "last_activity_at" TIMESTAMP, "crosswordId" integer, CONSTRAINT "PK_c6d46db005d623e691b2fbcba23" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "log" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "log" jsonb NOT NULL, "severity" text NOT NULL, CONSTRAINT "PK_350604cbdf991d5930d9e618fbd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "game_stats" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "roomId" integer NOT NULL, "correctGuesses" integer NOT NULL, "incorrectGuesses" integer NOT NULL, "isWinner" boolean NOT NULL DEFAULT false, "eloAtGame" double precision NOT NULL, "winStreak" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "correctGuessDetails" text, CONSTRAINT "PK_289bd8cd7cadaeb5f3f75746196" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."friend_status_enum" AS ENUM('pending', 'accepted', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "friend" ("id" SERIAL NOT NULL, "senderId" integer NOT NULL, "receiverId" integer NOT NULL, "status" "public"."friend_status_enum" NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "acceptedAt" TIMESTAMP, CONSTRAINT "PK_1b301ac8ac5fcee876db96069b6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."crossword_rating_difficultyrating_enum" AS ENUM('too_easy', 'just_right', 'too_hard')`,
    );
    await queryRunner.query(
      `CREATE TABLE "crossword_rating" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "crosswordId" integer NOT NULL, "difficultyRating" "public"."crossword_rating_difficultyrating_enum", "qualityRating" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP, CONSTRAINT "PK_dcae8586185a68affaa5a2aed67" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "room_players" ("room_id" integer NOT NULL, "user_id" integer NOT NULL, CONSTRAINT "PK_ae44a0f25fbb672267262ae5b98" PRIMARY KEY ("room_id", "user_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_969851ff175224dad99e6192c2" ON "room_players" ("room_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c152da3ec3120b58336e85f023" ON "room_players" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "support" ADD CONSTRAINT "FK_0768a9a514d90be0f9d00fd8036" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "room" ADD CONSTRAINT "FK_13ff26b1b261aabe0f8258822e3" FOREIGN KEY ("crosswordId") REFERENCES "crossword"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_stats" ADD CONSTRAINT "FK_c06c562c8c920b00646aad45710" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_stats" ADD CONSTRAINT "FK_00d86da0021695ad43154d0bc17" FOREIGN KEY ("roomId") REFERENCES "room"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "friend" ADD CONSTRAINT "FK_023929af0ef5c9dbf54fadce3d3" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "friend" ADD CONSTRAINT "FK_5a5b02c71a15805f570777fb4b5" FOREIGN KEY ("receiverId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "crossword_rating" ADD CONSTRAINT "FK_5bef35721c3de6ad0e115fe7489" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "crossword_rating" ADD CONSTRAINT "FK_585665ee664bcc50d859cf8c80f" FOREIGN KEY ("crosswordId") REFERENCES "crossword"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_players" ADD CONSTRAINT "FK_969851ff175224dad99e6192c2f" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_players" ADD CONSTRAINT "FK_c152da3ec3120b58336e85f023b" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "room_players" DROP CONSTRAINT "FK_c152da3ec3120b58336e85f023b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "room_players" DROP CONSTRAINT "FK_969851ff175224dad99e6192c2f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "crossword_rating" DROP CONSTRAINT "FK_585665ee664bcc50d859cf8c80f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "crossword_rating" DROP CONSTRAINT "FK_5bef35721c3de6ad0e115fe7489"`,
    );
    await queryRunner.query(
      `ALTER TABLE "friend" DROP CONSTRAINT "FK_5a5b02c71a15805f570777fb4b5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "friend" DROP CONSTRAINT "FK_023929af0ef5c9dbf54fadce3d3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_stats" DROP CONSTRAINT "FK_00d86da0021695ad43154d0bc17"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_stats" DROP CONSTRAINT "FK_c06c562c8c920b00646aad45710"`,
    );
    await queryRunner.query(
      `ALTER TABLE "room" DROP CONSTRAINT "FK_13ff26b1b261aabe0f8258822e3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "support" DROP CONSTRAINT "FK_0768a9a514d90be0f9d00fd8036"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c152da3ec3120b58336e85f023"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_969851ff175224dad99e6192c2"`,
    );
    await queryRunner.query(`DROP TABLE "room_players"`);
    await queryRunner.query(`DROP TABLE "crossword_rating"`);
    await queryRunner.query(
      `DROP TYPE "public"."crossword_rating_difficultyrating_enum"`,
    );
    await queryRunner.query(`DROP TABLE "friend"`);
    await queryRunner.query(`DROP TYPE "public"."friend_status_enum"`);
    await queryRunner.query(`DROP TABLE "game_stats"`);
    await queryRunner.query(`DROP TABLE "log"`);
    await queryRunner.query(`DROP TABLE "room"`);
    await queryRunner.query(`DROP TYPE "public"."room_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."room_type_enum"`);
    await queryRunner.query(`DROP TABLE "crossword"`);
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TYPE "public"."user_status_enum"`);
    await queryRunner.query(`DROP TABLE "support"`);
    await queryRunner.query(`DROP TYPE "public"."support_type_enum"`);
  }
}
