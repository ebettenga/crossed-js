import { FastifyInstance } from "fastify";
import { DataSource } from "typeorm";
import { Support } from "../../src/entities/Support";
import {
  cleanupSupportTestEnvironment,
  createTestSupportRequest,
  setupSupportTestEnvironment,
  SupportTestContext,
} from "./support-test-setup";
import {
  cleanupFastifyTest,
  setupFastifyTest,
} from "../helpers/fastify-test-helper";

describe("Support Endpoints", () => {
  let app: FastifyInstance;
  let dataSource: DataSource;
  let testContext: SupportTestContext | undefined;

  beforeAll(async () => {
    try {
      // Setup Fastify with support route
      const fastifyContext = await setupFastifyTest(
        "../../src/routes/private/support",
      );
      app = fastifyContext.app;
      dataSource = fastifyContext.dataSource;

      // Setup test environment with users
      testContext = await setupSupportTestEnvironment(app, dataSource);
    } catch (error) {
      console.error("Error in beforeAll:", error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      // Clean up test data if testContext was created
      if (testContext?.testUser && testContext?.adminUser) {
        await cleanupSupportTestEnvironment(
          dataSource,
          testContext.testUser,
          testContext.adminUser,
        );
      }

      // Cleanup Fastify and connections
      await cleanupFastifyTest(app);
    } catch (error) {
      console.error("Error in afterAll:", error);
      throw error;
    }
  });

  beforeEach(async () => {
    // Clean up all support requests before each test
    await dataSource.getRepository(Support).clear();
  });

  describe("GET /api/support", () => {
    it("should return all support requests for admin users", async () => {
      // Create some test support requests
      await createTestSupportRequest(
        dataSource,
        testContext!.testUser,
        "support",
        "Help with feature X",
      );
      await createTestSupportRequest(
        dataSource,
        testContext!.testUser,
        "suggestion",
        "Add feature Y",
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/support",
        headers: {
          authorization: `Bearer ${testContext!.adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const requests = JSON.parse(response.payload);
      expect(Array.isArray(requests)).toBe(true);
      expect(requests.length).toBe(2);
    });

    it("should return 403 for non-admin users", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/support",
        headers: {
          authorization: `Bearer ${testContext!.authToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const error = JSON.parse(response.payload);
      expect(error).toHaveProperty("error");
      expect(error.error).toBe("Unauthorized");
    });

    it("should return 403 when no authorization header is provided", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/support",
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("GET /api/support/me", () => {
    it("should return only the current user's support requests", async () => {
      // Create support requests for both users
      await createTestSupportRequest(
        dataSource,
        testContext!.testUser,
        "support",
        "User's request",
      );
      await createTestSupportRequest(
        dataSource,
        testContext!.adminUser,
        "support",
        "Admin's request",
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/support/me",
        headers: {
          authorization: `Bearer ${testContext!.authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const requests = JSON.parse(response.payload);
      expect(Array.isArray(requests)).toBe(true);
      expect(requests.length).toBe(1);
      expect(requests[0].comment).toBe("User's request");
      expect(requests[0].userId).toBe(testContext!.testUser.id);
    });

    it("should return empty array when user has no support requests", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/support/me",
        headers: {
          authorization: `Bearer ${testContext!.authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const requests = JSON.parse(response.payload);
      expect(Array.isArray(requests)).toBe(true);
      expect(requests.length).toBe(0);
    });

    it("should return 403 when no authorization header is provided", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/support/me",
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("POST /api/support", () => {
    it("should create a new support request with valid data", async () => {
      const newRequest = {
        type: "support",
        comment: "I need help with my account",
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/support",
        headers: {
          authorization: `Bearer ${testContext!.authToken}`,
          "content-type": "application/json",
        },
        payload: newRequest,
      });

      expect(response.statusCode).toBe(200);
      const created = JSON.parse(response.payload);
      expect(created).toHaveProperty("id");
      expect(created.type).toBe("support");
      expect(created.comment).toBe("I need help with my account");
      expect(created.userId).toBe(testContext!.testUser.id);

      // Verify it was saved to database
      const supportRepository = dataSource.getRepository(Support);
      const saved = await supportRepository.findOne({
        where: { id: created.id },
      });
      expect(saved).not.toBeNull();
      expect(saved?.comment).toBe(newRequest.comment);
    });

    it("should create a suggestion request", async () => {
      const newRequest = {
        type: "suggestion",
        comment: "Please add dark mode",
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/support",
        headers: {
          authorization: `Bearer ${testContext!.authToken}`,
          "content-type": "application/json",
        },
        payload: newRequest,
      });

      expect(response.statusCode).toBe(200);
      const created = JSON.parse(response.payload);
      expect(created.type).toBe("suggestion");
      expect(created.comment).toBe("Please add dark mode");
    });

    it("should return 400 when type is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/support",
        headers: {
          authorization: `Bearer ${testContext!.authToken}`,
          "content-type": "application/json",
        },
        payload: {
          comment: "Missing type field",
        },
      });

      expect(response.statusCode).toBe(400);
      const error = JSON.parse(response.payload);
      expect(error).toHaveProperty("error");
      expect(error.error).toBe("Type and comment are required");
    });

    it("should return 400 when comment is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/support",
        headers: {
          authorization: `Bearer ${testContext!.authToken}`,
          "content-type": "application/json",
        },
        payload: {
          type: "support",
        },
      });

      expect(response.statusCode).toBe(400);
      const error = JSON.parse(response.payload);
      expect(error).toHaveProperty("error");
      expect(error.error).toBe("Type and comment are required");
    });

    it("should return 403 when no authorization header is provided", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/support",
        headers: {
          "content-type": "application/json",
        },
        payload: {
          type: "support",
          comment: "Test comment",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 when invalid token is provided", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/support",
        headers: {
          authorization: "Bearer invalid-token",
          "content-type": "application/json",
        },
        payload: {
          type: "support",
          comment: "Test comment",
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
