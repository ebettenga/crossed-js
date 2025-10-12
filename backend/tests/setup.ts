// Mock jsonwebtoken before any modules are loaded
jest.mock("jsonwebtoken", () => {
  const actualJwt = jest.requireActual("jsonwebtoken");
  return {
    ...actualJwt,
    sign: jest.fn(() => "mock-jwt-token"),
    verify: jest.fn((token: string, secret: string) => {
      // Only accept our mock token
      if (token === "mock-jwt-token") {
        return { sub: 1, roles: ["user"] };
      }
      // Throw error for any other token (including "invalid-token")
      const error: any = new Error("jwt malformed");
      error.name = "JsonWebTokenError";
      throw error;
    }),
  };
});

// Mock the EmailService to avoid JSX/React email template issues
jest.mock("../src/services/EmailService", () => ({
  emailService: {
    sendPasswordResetEmail: jest.fn(),
  },
}));
