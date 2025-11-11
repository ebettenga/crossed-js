import "reflect-metadata";
import bcrypt from "bcrypt";
import { writeFile } from "node:fs/promises";
import AppDataSource from "../../src/db";
import { User } from "../../src/entities/User";
import { Crossword } from "../../src/entities/Crossword";
import { JoinMethod, Room } from "../../src/entities/Room";

const credential = process.env.PROFILE_TEST_CREDENTIAL ?? "test@example.com";
const password = process.env.PROFILE_TEST_PASSWORD ?? "password123";
const username = process.env.PROFILE_TEST_USERNAME ?? "testuser";
const primaryRoomId = Number(process.env.PROFILE_TEST_ROOM_ID ?? 62);
const timeTrialRoomRaw = process.env.PROFILE_TIME_TRIAL_ROOM_ID;
const timeTrialRoomId = Number(
  timeTrialRoomRaw && timeTrialRoomRaw.length > 0
    ? timeTrialRoomRaw
    : primaryRoomId + 1000,
);

if (!credential || !password) {
  throw new Error(
    "PROFILE_TEST_CREDENTIAL and PROFILE_TEST_PASSWORD must be defined",
  );
}

if (!Number.isFinite(primaryRoomId)) {
  throw new Error("PROFILE_TEST_ROOM_ID must be a valid number");
}

if (!Number.isFinite(timeTrialRoomId)) {
  throw new Error("PROFILE_TIME_TRIAL_ROOM_ID must be a valid number");
}

const grid = ["A", "D"];
const crosswordTitle = "Profiler Demo Crossword";

const maskGrid = (letters: string[]): string[] =>
  letters.map((value) => value.replace(/[A-Za-z]/g, "*"));

async function ensureUser(): Promise<User> {
  const repository = AppDataSource.getRepository(User);

  let user = await repository.findOne({
    where: { email: credential },
    withDeleted: false,
  });

  const hashedPassword = await bcrypt.hash(password, 10);

  if (!user) {
    user = repository.create({
      email: credential,
      username,
      password: hashedPassword,
      roles: ["user"],
      status: "online",
      eloRating: 1500,
      confirmed_mail: true,
    });
  } else {
    user.username = username;
    user.password = hashedPassword;
    user.status = "online";
    user.eloRating = user.eloRating || 1500;
  }

  return repository.save(user);
}

async function ensureCrossword(): Promise<Crossword> {
  const repository = AppDataSource.getRepository(Crossword);

  let crossword = await repository.findOne({
    where: { title: crosswordTitle },
  });

  if (!crossword) {
    crossword = repository.create({
      title: crosswordTitle,
      pack: "general",
      author: "Profiler Bot",
      created_by: "Automation",
      clues: {
        across: ["1. Warm-up word"],
        down: ["1. Starter"],
      },
      answers: {
        across: ["AD"],
        down: ["AD"],
      },
      grid,
      gridnums: ["1", "2"],
      col_size: 2,
      row_size: 1,
      date: new Date(),
      dow: "Monday",
    });
  } else {
    crossword.grid = grid;
    crossword.gridnums = ["1", "2"];
    crossword.col_size = 2;
    crossword.row_size = 1;
    crossword.clues = {
      across: ["1. Warm-up word"],
      down: ["1. Starter"],
    };
    crossword.answers = {
      across: ["AD"],
      down: ["AD"],
    };
  }

  return repository.save(crossword);
}

type RoomSeedContext = {
  roomId: number;
  type: Room["type"];
  status: Room["status"];
  isFinished: boolean;
  score: number;
};

async function recreateRoom(
  user: User,
  crossword: Crossword,
  context: RoomSeedContext,
): Promise<Room> {
  const repository = AppDataSource.getRepository(Room);
  await repository.delete({ id: context.roomId });

  const room = repository.create({
    id: context.roomId,
    type: context.type,
    status: context.status,
    join: JoinMethod.CLI,
    players: [user],
    crossword,
    difficulty: "easy",
    scores: { [user.id]: context.score },
    found_letters: context.isFinished
      ? [...(crossword.grid ?? [])]
      : maskGrid(crossword.grid ?? []),
    last_activity_at: new Date(),
    completed_at: context.isFinished ? new Date() : null,
    created_at: context.isFinished
      ? new Date(Date.now() - 10 * 60 * 1000)
      : new Date(),
  });

  return repository.save(room);
}

async function seed() {
  await AppDataSource.initialize();
  await AppDataSource.runMigrations();

  const user = await ensureUser();
  const crossword = await ensureCrossword();

  const activeRoom = await recreateRoom(user, crossword, {
    roomId: primaryRoomId,
    type: "1v1",
    status: "playing",
    isFinished: false,
    score: 0,
  });

  const leaderboardRoom = await recreateRoom(user, crossword, {
    roomId: timeTrialRoomId,
    type: "time_trial",
    status: "finished",
    isFinished: true,
    score: 150,
  });

  const summary = {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
    },
    rooms: {
      guessRoomId: activeRoom.id,
      leaderboardRoomId: leaderboardRoom.id,
    },
    crosswordId: crossword.id,
  };

  const output = JSON.stringify(summary, null, 2);
  console.log(output);

  const outputPath = process.env.PROFILE_SEED_OUTPUT_PATH;
  if (outputPath) {
    await writeFile(outputPath, output, "utf8");
  }

  await AppDataSource.destroy();
}

seed().catch(async (error) => {
  console.error("Profiling seed failed:", error);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
