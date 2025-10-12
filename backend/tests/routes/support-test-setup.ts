import { FastifyInstance } from "fastify";
import { DataSource } from "typeorm";
import { User } from "../../src/entities/User";
import { Support } from "../../src/entities/Support";

export interface SupportTestContext {
  app: FastifyInstance;
  dataSource: DataSource;
  testUser: User;
  adminUser: User;
  authToken: string;
  adminToken: string;
}

export async function setupSupportTestEnvironment(
  app: FastifyInstance,
  dataSource: DataSource,
): Promise<SupportTestContext> {
  const userRepository = dataSource.getRepository(User);

  // Create a regular test user with ID 1 (to match mock-jwt-token)
  const testUser = await userRepository.save({
    id: 1,
    email: "test@example.com",
    username: "testuser",
    password: "hashedpassword",
    confirmed_mail: true,
    roles: ["user"],
    description: "Test user",
    attributes: [],
    eloRating: 1200,
  });

  // Create an admin user with ID 2 (to match mock-admin-token)
  const adminUser = await userRepository.save({
    id: 2,
    email: "admin@example.com",
    username: "adminuser",
    password: "hashedpassword",
    confirmed_mail: true,
    roles: ["user", "admin"],
    description: "Admin user",
    attributes: [],
    eloRating: 1500,
  });

  // Use mock tokens (mocked in tests/setup.ts)
  // mock-jwt-token returns { sub: 1, roles: ["user"] }
  // mock-admin-token returns { sub: 2, roles: ["user", "admin"] }
  const authToken = "mock-jwt-token";
  const adminToken = "mock-admin-token";

  return {
    app,
    dataSource,
    testUser,
    adminUser,
    authToken,
    adminToken,
  };
}

export async function cleanupSupportTestEnvironment(
  dataSource: DataSource,
  testUser: User,
  adminUser: User,
): Promise<void> {
  // Clean up all support requests first
  await dataSource.getRepository(Support).clear();

  // Clean up related entities that reference users (in order of dependencies)
  await dataSource.query(
    'DELETE FROM crossword_rating WHERE "userId" IN ($1, $2)',
    [testUser?.id, adminUser?.id],
  );
  await dataSource.query('DELETE FROM game_stats WHERE "userId" IN ($1, $2)', [
    testUser?.id,
    adminUser?.id,
  ]);
  await dataSource.query(
    'DELETE FROM friend WHERE "senderId" IN ($1, $2) OR "receiverId" IN ($1, $2)',
    [testUser?.id, adminUser?.id],
  );

  // Clean up test users
  if (testUser?.id) {
    await dataSource.getRepository(User).delete({ id: testUser.id });
  }
  if (adminUser?.id) {
    await dataSource.getRepository(User).delete({ id: adminUser.id });
  }
}

export async function createTestSupportRequest(
  dataSource: DataSource,
  user: User,
  type: "support" | "suggestion" = "support",
  comment: string = "Test support request",
): Promise<Support> {
  const supportRepository = dataSource.getRepository(Support);
  const support = new Support();
  support.type = type;
  support.comment = comment;
  support.user = user;
  support.userId = user.id;

  return await supportRepository.save(support);
}
