import { FastifyInstance } from "fastify";
import { DataSource } from "typeorm";
import { User } from "../../src/entities/User";
import { Log } from "../../src/entities/Log";

export interface TestContext {
  app: FastifyInstance;
  dataSource: DataSource;
  testUser: User;
  authToken: string;
}

export async function setupTestEnvironment(
  app: FastifyInstance,
  dataSource: DataSource,
): Promise<TestContext> {
  // Create a test user (let database auto-generate ID)
  const userRepository = dataSource.getRepository(User);
  const testUser = await userRepository.save({
    email: "test-logs@example.com",
    username: "testuser-logs",
    password: "hashedpassword",
    confirmed_mail: true,
    roles: ["user"],
    description: "Test user for logs",
    attributes: [],
    eloRating: 1200,
  });

  // Update the JWT mock to return this user's ID
  const jwt = require("jsonwebtoken");
  jwt.verify.mockImplementation((token: string) => {
    if (token === "mock-jwt-token") {
      return { sub: testUser.id, roles: ["user"] };
    }
    const error: any = new Error("jwt malformed");
    error.name = "JsonWebTokenError";
    throw error;
  });

  const authToken = "mock-jwt-token";

  return {
    app,
    dataSource,
    testUser,
    authToken,
  };
}

export async function cleanupTestEnvironment(
  dataSource: DataSource,
  testUser: User,
): Promise<void> {
  // Clean up all logs
  await dataSource.getRepository(Log).clear();

  // Clean up related entities that reference the user
  await dataSource.query(
    'DELETE FROM crossword_rating WHERE "userId" = $1',
    [testUser?.id],
  );
  await dataSource.query('DELETE FROM game_stats WHERE "userId" = $1', [
    testUser?.id,
  ]);
  await dataSource.query(
    'DELETE FROM friend WHERE "senderId" = $1 OR "receiverId" = $1',
    [testUser?.id],
  );

  // Clean up test user
  if (testUser?.id) {
    await dataSource.getRepository(User).delete({ id: testUser.id });
  }
}

export async function createTestLogs(
  dataSource: DataSource,
  count: number = 2,
): Promise<Log[]> {
  const logRepository = dataSource.getRepository(Log);
  const logs: Log[] = [];

  for (let i = 0; i < count; i++) {
    const log = new Log();
    log.log = { message: `Test log ${i + 1}`, index: i };
    log.severity = i % 2 === 0 ? "info" : "error";
    logs.push(log);
  }

  return await logRepository.save(logs);
}
