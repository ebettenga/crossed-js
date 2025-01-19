import "reflect-metadata";
import fastifySecureSession from "@fastify/secure-session";
import fastifyIO from "fastify-socket.io";
import fastifyCors from "@fastify/cors";
import { registerDb } from "./db";
import { config } from "./config/config";
import fs from "fs";
import path, { join } from "path";
import { fastify } from "./fastify";
import fastifyPrintRoutes from 'fastify-print-routes'

// get the directory name of the current module
import { fileURLToPath } from "url";
import fastifyAutoload from "@fastify/autoload";
import { User } from "./entities/User";
import { Server } from "socket.io";
import { build } from './app';
import { workers, closeWorkers } from './jobs/workers';
import { FastifyInstance } from 'fastify';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await fastify.register(fastifyPrintRoutes);

// DB Stuff
registerDb(fastify);

// CORS
fastify.register(fastifyCors, config.cors);

// Auth Stuff
fastify.register(fastifySecureSession, {
  key: fs.readFileSync(path.join(__dirname, config.secretKeyPath)),
});

// Socket Stuff
fastify.register(fastifyIO, {
  cors: config.cors,
});

fastify.register(fastifyAutoload, {
  dir: join(__dirname, "./routes/private"),
  dirNameRoutePrefix: true,
  autoHooks: true,
  cascadeHooks: true,
  options: { prefix: config.api.prefix },
});

fastify.register(fastifyAutoload, {
  dir: join(__dirname, "./routes/public"),
  dirNameRoutePrefix: true,
  autoHooks: true,
  options: { prefix: config.api.prefix },
});

async function startServer() {
  if (config.mode === 'worker') {
    console.log('Starting in worker mode...');
    // Workers are automatically started when imported

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('Shutting down workers...');
      await closeWorkers();
      process.exit(0);
    });
  } else {
    console.log('Starting in API mode...');
    const server: FastifyInstance = await build({
      logger: config.logger,
    });

    try {
      await server.listen({ port: 3000, host: '0.0.0.0' });
    } catch (err) {
      server.log.error(err);
      process.exit(1);
    }
  }
}

declare module "fastify" {
  interface FastifyInstance {
    io: Server<any>;
  }

  interface FastifyRequest {
    user?: User;
  }
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
