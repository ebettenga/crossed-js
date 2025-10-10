import "reflect-metadata";
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

// Remove the findConfigDir function from here

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

// register all the plugins that our app uses

registerDb(fastify);

// Mock authentication by adding a preHandler hook
fastify.addHook("preHandler", async (request, reply) => {
  // Create a mock user for all requests
  const userRepo = fastify.orm.getRepository(User);
  let testUser = await userRepo.findOne({ where: { username: "testuser" } });

  if (!testUser) {
    testUser = userRepo.create({
      username: "testuser",
      email: "test@example.com",
      password: "testpassword",
      roles: ["user"],
      eloRating: 1000,
      gamesWon: 0,
      gamesLost: 0,
      guessAccuracy: 0,
      winRate: 0,
    });
    testUser = await userRepo.save(testUser);
  }

  // @ts-ignore - Adding user property for testing
  request.user = testUser;
});
fastify.register(fastifyIO);
fastify.register(fastifyAutoload, {
  dir: join(dirname, "src/routes"), // Corrected path
  dirNameRoutePrefix: true,
  options: { prefix: config.api.prefix },
});

export { fastify };
