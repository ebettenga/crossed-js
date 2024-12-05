import 'reflect-metadata';
import fastifySecureSession from '@fastify/secure-session';
import fastifyIO from 'fastify-socket.io';
import { registerDb } from './db';
import { config } from './config/config';
import { loggerConfig } from './logger';
import fs from 'fs';
import path, { join } from 'path';
import { fastify } from './fastify';

// get the directory name of the current module
import { fileURLToPath } from 'url';
import fastifyAutoload from '@fastify/autoload';
import winston from 'winston';
import { User } from './entities/User';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB Stuff
registerDb(fastify);

// Logger Stuff
fastify.decorate('logger', loggerConfig);

// Auth Stuff
fastify.register(fastifySecureSession, {
  key: fs.readFileSync(path.join(__dirname, config.secretKeyPath)),
});

// import { userPassport } from "./auth";
// import basicAuth from "@fastify/basic-auth";
import { validate } from './auth';
// const authenticate = { realm: "crossed" };
// fastify.register(basicAuth, { validate, authenticate });

// fastify.register(userPassport.initialize());
// fastify.register(userPassport.secureSession());

// Socket Stuff
fastify.register(fastifyIO);

fastify.register(fastifyAutoload, {
  dir: join(__dirname, './routes'),
  dirNameRoutePrefix: true,
  options: { prefix: config.api.prefix },
});

const start = async () => {
  try {
    await fastify.listen({
      port: config.api.port,
      host: config.api.host,
    });
    fastify.logger.info(
      'Running server on http://%s:%d',
      config.api.host,
      config.api.port,
    );
  } catch (err) {
    console.error(err);
    fastify.logger.error(err);
    process.exit(1);
  }
};

declare module 'fastify' {
  interface PassportUser extends User {}
  interface FastifyInstance {
    logger: winston.Logger;
  }
}

start();
