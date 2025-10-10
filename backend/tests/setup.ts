import "reflect-metadata";
import { jest } from "@jest/globals";
import fastifySecureSession from "@fastify/secure-session";
import fastifyIO from "fastify-socket.io";
import { registerDb } from "../src/db";
import { config } from "../src/config/config";
import fs from "fs";
import path from "path";
import { fastify } from "../src/fastify";
import fastifyAutoload from "@fastify/autoload";
import { join } from "path";
import { User } from "../src/entities/User";
import { config as testConfig } from "./config";
import { findDir } from "../src/scripts/findConfigDir";

const dirname = path.resolve(__dirname, "../");

// Mock AuthService before it's imported by the autohook
// @ts-ignore - Mocking for tests
jest.mock("../src/services/AuthService", () => {
  return {
    AuthService: jest.fn().mockImplementation(() => {
      return {
        // @ts-ignore - Mock return value
        verify: jest.fn().mockResolvedValue({ sub: 1, roles: ["user"] }),
        signup: jest.fn(),
        signin: jest.fn(),
        refresh: jest.fn(),
        forgotPassword: jest.fn(),
        updatePassword: jest.fn(),
      };
    }),
  };
});

// Mock RedisService to avoid Redis connection issues in tests
// @ts-ignore - Mocking for tests
jest.mock("../src/services/RedisService", () => {
  const mockRedisService = {
    getServerId: jest.fn().mockReturnValue("test-server-id"),
    cacheGame: jest.fn(),
    // @ts-ignore - Mock return value
    getGame: jest.fn().mockResolvedValue(null),
    registerUserSocket: jest.fn(),
    unregisterUserSocket: jest.fn(),
    // @ts-ignore - Mock return value
    isUserOnThisServer: jest.fn().mockResolvedValue(true),
    // @ts-ignore - Mock return value
    getUserServer: jest.fn().mockResolvedValue("test-server-id"),
    publish: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    close: jest.fn(),
  };

  return {
    RedisService: jest.fn().mockImplementation(() => mockRedisService),
    redisService: mockRedisService,
  };
});

let configDir = findDir(dirname, "config", {
  ignoreDirs: testConfig.ignoreDirs,
});
if (!configDir) {
  throw new Error("Config directory not found");
}

const secretKeyPath = path.join(configDir, "secret-key");
if (fs.existsSync(secretKeyPath)) {
  fastify.register(fastifySecureSession, {
    key: fs.readFileSync(secretKeyPath),
  });
} else {
  console.warn(`Secret key file not found at ${secretKeyPath}`);
  fastify.register(fastifySecureSession, {
    key: Buffer.from("a".repeat(32)), // Dummy key for testing
  });
}

// Register database
registerDb(fastify);

// Register socket.io
fastify.register(fastifyIO);

// Register routes - the autohook will use our mocked AuthService
fastify.register(fastifyAutoload, {
  dir: join(dirname, "src/routes"),
  dirNameRoutePrefix: true,
  options: { prefix: config.api.prefix },
});

export { fastify };
