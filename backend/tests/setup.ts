import "reflect-metadata";
import fastifySecureSession from "@fastify/secure-session";
import fastifyIO from "fastify-socket.io";
import { registerDb } from "../src/db";
import { config } from "../src/config/config";
import { loggerConfig } from "../src/logger";
import fs from "fs";
import path from "path";
import { fastify } from "../src/fastify";
import { userPassport } from "../src/auth";
import fastifyAutoload from "@fastify/autoload";
import { join } from "path";
import { User } from "../src/entities/User";

// get the directory name of the current module
const dirname = path.resolve(__dirname, '../');

// Function to find the config directory
const findConfigDir = (startPath: string, ignoreDirs: string[] = []): string | null => {
    const directories = fs.readdirSync(startPath, { withFileTypes: true });
    for (const dirent of directories) {
        if (dirent.isDirectory() && !ignoreDirs.includes(dirent.name)) {
            const configPath = path.join(startPath, dirent.name, 'config');
            if (fs.existsSync(configPath) && fs.statSync(configPath).isDirectory()) {
                return configPath;
            }
            const nestedConfigPath = findConfigDir(path.join(startPath, dirent.name), ignoreDirs);
            if (nestedConfigPath) {
                return nestedConfigPath;
            }
        }
    }
    return null;
}

let configDir = findConfigDir(dirname, ['node_modules', 'dist', 'build', 'coverage', 'tests']);
if (!configDir) {
  throw new Error('Config directory not found');
}


const secretKeyPath = path.join(configDir, 'secret-key');
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

// DB Stuff
registerDb(fastify);

// Logger Stuff
fastify.decorate("logger", loggerConfig);

// Auth Stuff
fastify.register(userPassport.initialize());
fastify.register(userPassport.secureSession());

// Dummy Passport Middleware
fastify.addHook('preValidation', (request, reply, done) => {
  request.user = {
    id: 1,
    username: 'testuser',
    role: 'USER',
    created_at: new Date(),
    updated_at: new Date()
  } as User; // Dummy user
  done();
});

// Socket Stuff
fastify.register(fastifyIO);

fastify.register(fastifyAutoload, {
  dir: join(dirname, "src/routes"), // Corrected path
  dirNameRoutePrefix: true,
  options: { prefix: config.api.prefix },
});

export { fastify };