import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { fastify } from "../setup";
import { RoomService } from "../../src/services/RoomService";
import { User } from "../../src/entities/User";
import { Room } from "../../src/entities/Room";

describe("Rooms routes", () => {
  let testUser: User;

  beforeAll(async () => {
    await fastify.ready();

    // Create or get a test user
    const userRepo = fastify.orm.getRepository(User);
    testUser = await userRepo.findOne({ where: { username: "testuser" } }) ||
      await userRepo.save({
        username: "testuser",
        email: "test@example.com",
        password: "testpassword",
        roles: ["user"],
        eloRating: 1000,
      });
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("should get a room by ID", async () => {
    const room = await fastify.orm.getRepository(Room).findOne({
      where: { difficulty: "easy" },
      relations: ["players", "crossword"],
    });

    if (!room) {
      throw new Error("Room not found");
    }

    const response = await fastify.inject({
      method: "GET",
      url: `/api/rooms/${room.id}`,
      headers: {
        authorization: "Bearer test-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("id");
    expect(response.json()).toHaveProperty("found_letters");
    expect(response.json()).toHaveProperty("difficulty");
  });

  it("should join a room", async () => {
    const payload = { difficulty: "easy", type: "1v1" };

    const response = await fastify.inject({
      method: "POST",
      url: "/api/rooms/join",
      payload,
      headers: {
        authorization: "Bearer test-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("id");
    expect(response.json()).toHaveProperty("players");
  });

  it("should handle a guess on a room", async () => {
    const testRoom = await fastify.orm.getRepository(Room).findOne({
      where: { difficulty: "easy", status: "playing" },
      relations: ["players", "crossword"],
    });

    if (!testRoom) {
      throw new Error("No playing room found for testing");
    }

    const payload = {
      coordinates: { x: 0, y: 0 },
      guess: "A",
    };

    const response = await fastify.inject({
      method: "POST",
      url: `/api/rooms/${testRoom.id}`,
      payload,
      headers: {
        authorization: "Bearer test-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("scores");
  });

  it("should handle errors gracefully", async () => {
    jest
      .spyOn(RoomService.prototype, "getRoomById")
      .mockRejectedValueOnce(new Error("Database error"));

    const response = await fastify.inject({
      method: "GET",
      url: "/api/rooms/1",
      headers: {
        authorization: "Bearer test-token",
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: "Internal Server Error",
      message: "Database error",
      statusCode: 500,
    });
  });
});
