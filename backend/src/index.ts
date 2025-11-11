import "reflect-metadata";
import fastifySecureSession from "@fastify/secure-session";
import fastifyIO from "fastify-socket.io";
import fastifyCors from "@fastify/cors";
import AppDataSource, { registerDb } from "./db";
import { config } from "./config/config";
import fs from "fs";
import path, { join } from "path";
import { writeHeapSnapshot } from "node:v8";
import inspector from "node:inspector";
import { fastify } from "./fastify";
import fastifyPrintRoutes from "fastify-print-routes";

// get the directory name of the current module
import { fileURLToPath } from "url";
import fastifyAutoload from "@fastify/autoload";
import { User } from "./entities/User";
import { Server } from "socket.io";
import { closeWorkers, initializeWorkers } from "./jobs/workers/index";

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

if (process.env.ENABLE_PROFILING_ROUTES === "true") {
  const heapSnapshotDir = process.env.HEAP_SNAPSHOT_DIR || "./";
  const cpuProfileDir = process.env.CPU_PROFILE_DIR || "./";
  let cpuProfilerSession: inspector.Session | null = null;

  const ensureDirectory = async (dir: string) => {
    await fs.promises.mkdir(dir, { recursive: true });
  };

  fastify.post("/internal/profiling/heap-snapshot", async (_request, reply) => {
    try {
      await ensureDirectory(heapSnapshotDir);
      const filePath = path.join(
        heapSnapshotDir,
        `heap-${Date.now()}.heapsnapshot`,
      );
      const savedPath = writeHeapSnapshot(filePath);
      reply.send({ snapshot: savedPath });
    } catch (error) {
      fastify.log.error({ err: error }, "Failed to capture heap snapshot");
      reply.code(500).send({ error: "Failed to capture heap snapshot" });
    }
  });

  fastify.post("/internal/profiling/cpu-profile/start", async (_request, reply) => {
    if (cpuProfilerSession) {
      reply.code(409).send({ error: "CPU profiler already running" });
      return;
    }

    try {
      cpuProfilerSession = new inspector.Session();
      cpuProfilerSession.connect();
      await new Promise<void>((resolve, reject) => {
        cpuProfilerSession!.post("Profiler.enable", (err) =>
          err ? reject(err) : resolve()
        );
      });
      await new Promise<void>((resolve, reject) => {
        cpuProfilerSession!.post("Profiler.start", (err) =>
          err ? reject(err) : resolve()
        );
      });
      reply.send({ status: "started" });
    } catch (error) {
      fastify.log.error({ err: error }, "Failed to start CPU profiler");
      if (cpuProfilerSession) {
        cpuProfilerSession.disconnect();
        cpuProfilerSession = null;
      }
      reply.code(500).send({ error: "Failed to start CPU profiler" });
    }
  });

  fastify.post("/internal/profiling/cpu-profile/stop", async (_request, reply) => {
    if (!cpuProfilerSession) {
      reply.code(400).send({ error: "CPU profiler is not running" });
      return;
    }

    try {
      const profile = await new Promise<any>((resolve, reject) => {
        cpuProfilerSession!.post("Profiler.stop", (err, params) => {
          if (err) return reject(err);
          resolve(params.profile);
        });
      });

      await new Promise<void>((resolve, reject) => {
        cpuProfilerSession!.post("Profiler.disable", (err) =>
          err ? reject(err) : resolve()
        );
      });
      cpuProfilerSession.disconnect();
      cpuProfilerSession = null;

      await ensureDirectory(cpuProfileDir);
      const filePath = path.join(
        cpuProfileDir,
        `cpu-${Date.now()}.cpuprofile`,
      );
      await fs.promises.writeFile(filePath, JSON.stringify(profile));
      reply.send({ profile: filePath });
    } catch (error) {
      fastify.log.error({ err: error }, "Failed to stop CPU profiler");
      if (cpuProfilerSession) {
        cpuProfilerSession.disconnect();
        cpuProfilerSession = null;
      }
      reply.code(500).send({ error: "Failed to stop CPU profiler" });
    }
  });
}

async function startServer() {
  if (config.mode === "worker") {
    fastify.log.info("Starting in worker mode...");

    // Ensure database is initialized
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    await fastify.ready();

    // Initialize workers with database connection
    initializeWorkers(AppDataSource, fastify.io);

    // Handle graceful shutdown
    process.on("SIGTERM", async () => {
      fastify.log.info("Shutting down workers...");
      await closeWorkers();
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
      }
      process.exit(0);
    });
  } else {
    try {
      await fastify.listen({ port: config.api.port, host: config.api.host });
    } catch (err) {
    fastify.log.error({ err }, "Failed to start Fastify server");
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
  console.error("Failed to start server:", err);
  process.exit(1);
});
