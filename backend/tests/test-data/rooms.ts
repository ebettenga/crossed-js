import { DataSource } from "typeorm";
import { Room } from "../../src/entities/Room";
import { User } from "../../src/entities/User";
import { Crossword } from "../../src/entities/Crossword";
import { GameStats } from "../../src/entities/GameStats";

const testUsers = [
  {
    username: "testplayer1",
    roles: ["user"],
    email: "crosswordtester1@test.com",
    password: "testpassword",
  },
  {
    username: "testplayer2",
    roles: ["user"],
    email: "crosswordtester2@test.com",
    password: "testpassword",
  },
];

const testCrosswords = [
  {
    clues: { across: [], down: [] },
    answers: { across: [], down: [] },
    author: "Test Author",
    circles: [],
    date: new Date(),
    dow: "Monday",
    grid: ["x", "x", "x", "x", "x"],
    gridnums: [],
    shadecircles: false,
    col_size: 4,
    row_size: 4,
    jnote: "The quick brown fox jumps over the lazy dog",
    notepad: "Test notepad",
    title: "Test Crossword",
  },
];

export const create = async (connection: DataSource) => {
  const roomRepository = connection.getRepository(Room);
  const userRepository = connection.getRepository(User);
  const crosswordRepository = connection.getRepository(Crossword);
  const gameStatsRepository = connection.getRepository(GameStats);

  const user1 = await userRepository.save(testUsers[0]);
  const user2 = await userRepository.save(testUsers[1]);
  const crossword = await crosswordRepository.save(testCrosswords[0]);

  const baseRoom = roomRepository.create({
    crossword,
    found_letters: ["*", "*", "*", "*", "*", "*", "*", "*", "*", "*", "*"],
    difficulty: "easy",
    status: "finished",
    type: "1v1",
    players: [user1, user2],
    scores: {
      [user1.id]: 12,
      [user2.id]: 8,
    },
  });

  const savedRoom = await roomRepository.save(baseRoom);

  await gameStatsRepository.save([
    {
      user: user1,
      userId: user1.id,
      room: savedRoom,
      roomId: savedRoom.id,
      correctGuesses: 8,
      incorrectGuesses: 2,
      isWinner: true,
      eloAtGame: user1.eloRating,
      winStreak: 3,
    },
    {
      user: user2,
      userId: user2.id,
      room: savedRoom,
      roomId: savedRoom.id,
      correctGuesses: 6,
      incorrectGuesses: 4,
      isWinner: false,
      eloAtGame: user2.eloRating,
      winStreak: 0,
    },
  ]);

  console.log("Test room created.");
};

export const createEloTestScenario = () => {
  const roomId = 101;

  const rookie = Object.assign(new User(), {
    id: 1,
    username: "rookie_player",
    eloRating: 1200,
    gameStats: [] as GameStats[],
  });

  const veteran = Object.assign(new User(), {
    id: 2,
    username: "veteran_player",
    eloRating: 1200,
    gameStats: [] as GameStats[],
  });

  const room = Object.assign(new Room(), {
    id: roomId,
    type: "1v1" as Room["type"],
    status: "finished" as Room["status"],
    players: [
      { id: rookie.id } as User,
      { id: veteran.id } as User,
    ],
    scores: {
      [rookie.id]: 15,
      [veteran.id]: 10,
    },
  });

  return {
    room,
    rookie,
    veteran,
  };
};

export const createFreeForAllScenario = () => {
  const roomId = 202;

  const leader = Object.assign(new User(), {
    id: 10,
    username: "ffa_leader",
    eloRating: 1400,
    gameStats: [] as GameStats[],
  });

  const chaser = Object.assign(new User(), {
    id: 11,
    username: "ffa_chaser",
    eloRating: 1300,
    gameStats: [] as GameStats[],
  });

  const challenger = Object.assign(new User(), {
    id: 12,
    username: "ffa_challenger",
    eloRating: 1200,
    gameStats: [] as GameStats[],
  });

  const room = Object.assign(new Room(), {
    id: roomId,
    type: "free4all" as Room["type"],
    status: "finished" as Room["status"],
    players: [
      { id: leader.id } as User,
      { id: chaser.id } as User,
      { id: challenger.id } as User,
    ],
    scores: {
      [leader.id]: 30,
      [chaser.id]: 20,
      [challenger.id]: 10,
    },
  });

  return {
    room,
    players: [leader, chaser, challenger] satisfies User[],
  };
};
