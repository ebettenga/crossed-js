import fs from "fs";
import path from "path";
import inspector from "node:inspector";
import { writeHeapSnapshot } from "node:v8";
import type { FastifyInstance } from "fastify";

type ProfilingRoutesOptions = {
  heapSnapshotDir?: string;
  heapProfileDir?: string;
  cpuProfileDir?: string;
};

export async function registerProfilingRoutes(
  fastify: FastifyInstance,
  options: ProfilingRoutesOptions = {},
) {
  const heapSnapshotDir = options.heapSnapshotDir || "./";
  const heapProfileDir = options.heapProfileDir || heapSnapshotDir;
  const cpuProfileDir = options.cpuProfileDir || "./";

  let cpuProfilerSession: inspector.Session | null = null;
  let heapProfilerSession: inspector.Session | null = null;

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
          err ? reject(err) : resolve(),
        );
      });
      await new Promise<void>((resolve, reject) => {
        cpuProfilerSession!.post("Profiler.start", (err) =>
          err ? reject(err) : resolve(),
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
          err ? reject(err) : resolve(),
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

  fastify.post("/internal/profiling/heap-profile/start", async (_request, reply) => {
    if (heapProfilerSession) {
      reply.code(409).send({ error: "Heap profiler already running" });
      return;
    }

    try {
      heapProfilerSession = new inspector.Session();
      heapProfilerSession.connect();
      await new Promise<void>((resolve, reject) => {
        heapProfilerSession!.post("HeapProfiler.enable", (err) =>
          err ? reject(err) : resolve(),
        );
      });
      await new Promise<void>((resolve, reject) => {
        heapProfilerSession!.post(
          "HeapProfiler.startSampling",
          { samplingInterval: 512 * 1024 },
          (err) => (err ? reject(err) : resolve()),
        );
      });
      reply.send({ status: "started" });
    } catch (error) {
      fastify.log.error({ err: error }, "Failed to start heap profiler");
      if (heapProfilerSession) {
        heapProfilerSession.disconnect();
        heapProfilerSession = null;
      }
      reply.code(500).send({ error: "Failed to start heap profiler" });
    }
  });

  fastify.post("/internal/profiling/heap-profile/stop", async (_request, reply) => {
    if (!heapProfilerSession) {
      reply.code(400).send({ error: "Heap profiler is not running" });
      return;
    }

    try {
      const profile = await new Promise<any>((resolve, reject) => {
        heapProfilerSession!.post("HeapProfiler.stopSampling", (err, params) => {
          if (err) return reject(err);
          resolve(params.profile);
        });
      });
      await new Promise<void>((resolve, reject) => {
        heapProfilerSession!.post("HeapProfiler.disable", (err) =>
          err ? reject(err) : resolve(),
        );
      });
      heapProfilerSession.disconnect();
      heapProfilerSession = null;

      await ensureDirectory(heapProfileDir);
      const filePath = path.join(
        heapProfileDir,
        `heap-profile-${Date.now()}.heapprofile`,
      );
      await fs.promises.writeFile(filePath, JSON.stringify(profile));
      reply.send({ profile: filePath });
    } catch (error) {
      fastify.log.error({ err: error }, "Failed to stop heap profiler");
      if (heapProfilerSession) {
        heapProfilerSession.disconnect();
        heapProfilerSession = null;
      }
      reply.code(500).send({ error: "Failed to stop heap profiler" });
    }
  });
}
