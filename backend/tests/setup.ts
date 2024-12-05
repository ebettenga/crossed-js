import 'reflect-metadata';
import fastifySecureSession from '@fastify/secure-session';
import fastifyIO from 'fastify-socket.io';
import { registerDb } from '../src/db';
import { config } from '../src/config/config';
import { loggerConfig } from '../src/logger';
import fs from 'fs';
import path from 'path';
import { fastify } from '../src/fastify';
import { userPassport } from '../src/auth';
import fastifyAutoload from '@fastify/autoload';
import { join } from 'path';
import { User } from '../src/entities/User';
import { config as testConfig } from './config';

const dirname = path.resolve(__dirname, '../');

type FindConfigDirOptions = {
  ignoreDirs: string[];
};

const findConfigDir = (
  startPath: string,
  options: FindConfigDirOptions,
): string | null => {
  const { ignoreDirs } = options;
  const directories = fs.readdirSync(startPath, { withFileTypes: true });
  for (const dirent of directories) {
    if (dirent.isDirectory() && !ignoreDirs.includes(dirent.name)) {
      const configPath = path.join(startPath, dirent.name, 'config');
      if (fs.existsSync(configPath) && fs.statSync(configPath).isDirectory()) {
        return configPath;
      }
      const nestedConfigPath = findConfigDir(
        path.join(startPath, dirent.name),
        options,
      );
      if (nestedConfigPath) {
        return nestedConfigPath;
      }
    }
  }
  return null;
};

let configDir = findConfigDir(dirname, {
  ignoreDirs: testConfig.ignoreDirs,
});
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
    key: Buffer.from('a'.repeat(32)), // Dummy key for testing
  });
}

// register all the plugins that our app uses

registerDb(fastify);
fastify.decorate('logger', loggerConfig);

// Mock the authenticate method to bypass actual authentication
// this typescript will try to convince you that done is not the third argument of authenticate, but it is
// @ts-ignore
userPassport.authenticate = () => (request, reply, done) => {
  request.user = {
    id: 1,
    username: 'testuser',
    role: 'USER',
    created_at: new Date(),
    updated_at: new Date(),
  } as User; // Dummy user
  done();
};

fastify.register(userPassport.initialize());
fastify.register(userPassport.secureSession());
fastify.register(fastifyIO);
fastify.register(fastifyAutoload, {
  dir: join(dirname, 'src/routes'), // Corrected path
  dirNameRoutePrefix: true,
  options: { prefix: config.api.prefix },
});

export { fastify };
