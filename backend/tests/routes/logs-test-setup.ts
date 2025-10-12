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
  // Create a test user
  const userRepository = dataSource.getRepository(User);
  const testUser = await userRepository.save({
    email: "test@example.com",
    username: "testuser",
    password: "hashedpassword",
    confirmed_mail: true,
    roles: ["user"],
    description: "Test user",
    attributes: [],
    eloRating: 1200,
  });

  // Use a mock token (mocked in the test file)
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
