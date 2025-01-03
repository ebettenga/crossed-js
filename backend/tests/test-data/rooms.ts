import { DataSource } from "typeorm";
import { Room } from "../../src/entities/Room";
import { User } from "../../src/entities/User";
import { Crossword } from "../../src/entities/Crossword";

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

  const user1 = await userRepository.save(testUsers[0]);
  const user2 = await userRepository.save(testUsers[1]);
  const crossword = await crosswordRepository.save(testCrosswords[0]);

  await roomRepository.save({
    crossword,
    found_letters: ["*", "*", "*", "*", "*", "*", "*", "*", "*", "*", "*"],
    difficulty: "easy",
  });
  console.log("Test room created.");
};
