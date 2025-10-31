import type { DataSource } from "typeorm";
import { Room } from "../../src/entities/Room";

process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const emitToRoom = jest.fn();
const emitToUsers = jest.fn();

jest.mock("../../src/services/SocketEventService", () => ({
  createSocketEventService: () => ({
    emitToRoom,
    emitToUsers,
  }),
}));

type WorkerLike = {
  process(job: any): Promise<void>;
};

const workerInstances: WorkerLike[] = [];

jest.mock("bullmq", () => {
  class Worker {
    public processor: (job: any) => Promise<void>;
    private handlers: Record<string, (job: any, err?: Error) => void> = {};

    constructor(_name: string, processor: (job: any) => Promise<void>) {
      this.processor = processor;
      workerInstances.push(this as unknown as WorkerLike);
    }

    on(event: string, handler: (job: any, err?: Error) => void) {
      this.handlers[event] = handler;
    }

    async process(job: any) {
      try {
        await this.processor(job);
        if (this.handlers["completed"]) {
          this.handlers["completed"](job);
        }
      } catch (error) {
        if (this.handlers["failed"]) {
          this.handlers["failed"](job, error as Error);
        }
        throw error;
      }
    }

    async close() {
      // no-op
    }
  }

  return { Worker };
});

const { createGameTimeoutWorker } = require(
  "../../src/jobs/workers/game-timeout.worker",
);

describe("game timeout worker", () => {
  let dataSource: DataSource;
  const repository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const fastify: any = {};

  beforeEach(() => {
    repository.findOne.mockReset();
    repository.save.mockReset();
    emitToRoom.mockReset();
    emitToUsers.mockReset();
    workerInstances.length = 0;

    dataSource = {
      isInitialized: true,
      initialize: jest.fn(),
      getRepository: jest.fn(() => repository),
    } as unknown as DataSource;
  });

  it("cancels pending games and notifies players when the timeout expires", async () => {
    const room = new Room();
    room.id = 42;
    room.status = "pending";
    room.players = [{ id: 7 } as any];

    repository.findOne.mockResolvedValue(room);
    repository.save.mockResolvedValue({ ...room });

    createGameTimeoutWorker(dataSource, fastify);
    expect(workerInstances).toHaveLength(1);

    const job = { data: { roomId: room.id } };
    await workerInstances[0].process(job);

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" }),
    );
    expect(emitToRoom).toHaveBeenCalledWith(
      room.id,
      "room_cancelled",
      expect.objectContaining({
        roomId: room.id,
        reason: "pending_timeout",
      }),
    );
    expect(emitToUsers).toHaveBeenCalledWith(
      [room.players[0].id],
      "room_cancelled",
      expect.objectContaining({
        message: expect.stringContaining("couldn't find"),
        roomId: room.id,
        reason: "pending_timeout",
      }),
    );
  });
});
