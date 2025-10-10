import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { fastify } from "../setup";
import { Room } from "../../src/entities/Room";
import { User } from "../../src/entities/User";
import { Crossword } from "../../src/entities/Crossword";

describe("GET /rooms/:roomId/leaderboard/time-trial", () => {
  let user: User;
  let crossword: Crossword;
  let room1: Room;
  let room2: Room;

  beforeAll(async () => {
    await fastify.ready();

    const userRepo = fastify.orm.getRepository(User);
    const crosswordRepo = fastify.orm.getRepository(Crossword);
    const roomRepo = fastify.orm.getRepository(Room);

    // Create leaderboard user
    user = userRepo.create({
      username: "leaderUser",
      email: "leader@test.com",
      password: "testpassword",
      roles: ["user"],
    });
    user = await userRepo.save(user);

    // Create a simple crossword
    crossword = crosswordRepo.create({
      clues: { across: [], down: [] },
      answers: { across: [], down: [] },
      col_size: 2,
      row_size: 2,
      title: "Leaderboard Test Crossword",
      author: "Test",
      grid: ["*", "*", "*", "*"],
      gridnums: ["0", "0", "0", "0"],
      shadecircles: false,
      jnote: "Test",
      notepad: "Test",
    });
    crossword = await crosswordRepo.save(crossword);

    // Helper to create a finished time-trial room with a given score and completion delta
    const createFinishedTimeTrial = async (
      score: number,
      completionDelayMs: number,
    ) => {
      const completedAt = new Date(Date.now() + completionDelayMs);
      const room = roomRepo.create({
        type: "time_trial",
        status: "finished",
        players: [user],
        crossword,
        difficulty: "easy",
        scores: { [user.id]: score },
        completed_at: completedAt,
        // found_letters defaults are fine; not needed for leaderboard
      } as Partial<Room> as Room);
      return await roomRepo.save(room);
    };

    // Two finished time-trial games on the same crossword
    // Different scores ensure deterministic ordering by score first
    room1 = await createFinishedTimeTrial(120, 2000);
    room2 = await createFinishedTimeTrial(150, 1000);
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("returns a leaderboard sorted by highest score (then fastest time)", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: `/api/rooms/${room1.id}/leaderboard/time-trial?limit=5`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);

    // Expect the highest score first
    expect(body[0]).toHaveProperty("rank", 1);
    expect(body[0]).toHaveProperty("score", 150);
    expect(body[1]).toHaveProperty("score", 120);

    // Validate basic structure of entries
    const entry = body[0];
    expect(entry).toHaveProperty("roomId");
    expect(typeof entry.roomId).toBe("number");

    expect(entry).toHaveProperty("created_at");
    expect(typeof entry.created_at).toBe("string");

    // completed_at should be an ISO string or null
    expect(entry).toHaveProperty("completed_at");
    if (entry.completed_at !== null) {
      expect(typeof entry.completed_at).toBe("string");
    }

    // timeTakenMs may be number or null if timestamps are unavailable
    expect(entry).toHaveProperty("timeTakenMs");
    if (entry.timeTakenMs !== null) {
      expect(typeof entry.timeTakenMs).toBe("number");
    }

    // user object may be present with id/username/eloRating
    if (entry.user) {
      expect(entry.user).toHaveProperty("id");
      expect(entry.user).toHaveProperty("username");
      expect(entry.user).toHaveProperty("eloRating");
    }
  });

  it("rejects non-time_trial rooms with 400", async () => {
    // Create a finished non-time-trial room to trigger the 400 guard
    const roomRepo = fastify.orm.getRepository(Room);
    const nonTimeTrial = roomRepo.create({
      type: "1v1",
      status: "finished",
      players: [user],
      crossword,
      difficulty: "easy",
      scores: { [user.id]: 999 },
      completed_at: new Date(),
    } as Partial<Room> as Room);
    const saved = await roomRepo.save(nonTimeTrial);

    const response = await fastify.inject({
      method: "GET",
      url: `/api/rooms/${saved.id}/leaderboard/time-trial`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty(
      "error",
      "Leaderboard is only available for time_trial games",
    );
  });
});
