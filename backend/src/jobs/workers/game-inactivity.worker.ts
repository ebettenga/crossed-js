import { Worker } from "bullmq";
import { config } from "../../config/config";
import { DataSource } from "typeorm";
import { Room } from "../../entities/Room";
import { NotFoundError } from "../../errors/api";
import { FastifyInstance } from "fastify";
import { createSocketEventService } from "../../services/SocketEventService";
import { gameInactivityQueue } from "../queues";
import { v4 as uuidv4 } from "uuid";
import { Crossword } from "../../entities/Crossword";
/**
 * Find a random unsolved letter position in the puzzle
 * @param foundLetters Array of found letters where "*" represents unsolved
 * @param crossword The crossword puzzle data
 * @returns Position and letter, or null if no unsolved letters
 */
function findRandomUnsolvedLetter(
  foundLetters: string[],
  crossword: Crossword,
): { index: number; letter: string } | null {
  // Get all unsolved positions (marked with "*")
  const unsolvedPositions = foundLetters
    .map((letter, index) => ({ letter, index }))
    .filter(({ letter }) => letter === "*");

  if (unsolvedPositions.length === 0) return null;

  // Pick a random unsolved position
  const randomPosition =
    unsolvedPositions[Math.floor(Math.random() * unsolvedPositions.length)];

  // Get the actual letter from the crossword solution
  const letter = crossword.grid[randomPosition.index];

  return {
    index: randomPosition.index,
    letter,
  };
}

/**
 * Calculate the dynamic timeout interval based on puzzle completion
 * @param completionRate Percentage of puzzle completed (0 to 1)
 * @returns Timeout in milliseconds
 */
function calculateDynamicTimeout(completionRate: number): number {
  const { initial, minimum, accelerationRate, completionStep } =
    config.game.timeout.inactivity;

  // Calculate how many completion steps we've passed
  const steps = Math.floor(completionRate / completionStep);

  // Calculate the reduction factor based on steps
  // Each step reduces the timeout by accelerationRate
  const reductionFactor = Math.pow(1 - accelerationRate, steps);

  // Calculate the new timeout
  const timeout = Math.max(
    minimum,
    initial * reductionFactor,
  );

  return Math.round(timeout);
}

export const createGameInactivityWorker = (
  dataSource: DataSource,
  fastify: FastifyInstance,
) => {
  const socketEventService = createSocketEventService(fastify);

  const ensureConnection = async () => {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
  };

  const worker = new Worker(
    "game-inactivity",
    async (job) => {
      console.log("Game inactivity worker started");
      await ensureConnection();

      // Start a transaction
      const queryRunner = dataSource.createQueryRunner();
      let transactionStarted = false;

      try {
        // Connect and start transaction
        await queryRunner.connect();
        await queryRunner.startTransaction();
        transactionStarted = true;

        // First get and lock just the room
        const room = await queryRunner.manager
          .getRepository(Room)
          .createQueryBuilder("room")
          .setLock("pessimistic_write")
          .where("room.id = :roomId", { roomId: job.data.roomId })
          .getOne();

        if (!room) {
          throw new NotFoundError("Room not found");
        }

        // Then get the crossword with a separate query
        const crossword = await queryRunner.manager
          .getRepository(Crossword)
          .createQueryBuilder("crossword")
          .where("crossword.id = :id", { id: room.crossword?.id })
          .getOne();

        if (!crossword) {
          throw new Error("Room has no crossword");
        }

        // Attach the crossword to the room
        room.crossword = crossword;

        // Then load players relation separately
        await queryRunner.manager
          .getRepository(Room)
          .createQueryBuilder()
          .relation(Room, "players")
          .of(room)
          .loadMany();

        // Only process if the game is still active
        if (room.status === "playing") {
          // Calculate completion rate (number of found letters / total letters)
          const totalLetters = room.found_letters.length;
          const foundLetters = room.found_letters.filter((letter) =>
            letter !== "*"
          ).length;
          const completionRate = foundLetters / totalLetters;

          // Calculate the next timeout interval
          const nextTimeout = calculateDynamicTimeout(completionRate);

          console.log("Room activity timestamps:", {
            roomId: room.id,
            lastActivityFromJob: new Date(job.data.lastActivityTimestamp)
              .toISOString(),
            lastActivityFromRoom: room.last_activity_at?.toISOString(),
            now: new Date().toISOString(),
            jobTimestamps: {
              timestamp: job.timestamp
                ? new Date(job.timestamp).toISOString()
                : null,
              processedOn: job.processedOn
                ? new Date(job.processedOn).toISOString()
                : null,
              finishedOn: job.finishedOn
                ? new Date(job.finishedOn).toISOString()
                : null,
            },
          });

          // Safety check: If last_activity_at is null, set it to now
          if (!room.last_activity_at) {
            console.log(
              `Room ${room.id} has no last_activity_at, setting to now`,
            );
            room.last_activity_at = new Date();
            await queryRunner.manager.save(Room, room);
          }

          // If there's been no activity since the last check OR if the job's timestamp is older than the activity timestamp
          const isInactive =
            job.data.lastActivityTimestamp === room.last_activity_at?.getTime() ||
            (job.data.lastActivityTimestamp && room.last_activity_at &&
              job.data.lastActivityTimestamp < room.last_activity_at.getTime());

          if (isInactive) {
            console.log(
              `No activity detected for room ${room.id} since last check`,
            );
            // Find a random unsolved letter to reveal
            const letterToReveal = findRandomUnsolvedLetter(
              room.found_letters,
              room.crossword,
            );

            if (letterToReveal) {
              // Reveal the letter
              room.found_letters[letterToReveal.index] = letterToReveal.letter;
              room.last_activity_at = new Date();

              // Check if all letters have been revealed
              const isGameFinished = !room.found_letters.includes("*");
              console.log(
                `Room ${room.id} game finished status:`,
                isGameFinished,
              );
              if (isGameFinished) {
                room.status = "finished";
                room.completed_at = new Date();
              }

              await queryRunner.manager.save(Room, room);

              // Notify players about inactivity and revealed letter
              await socketEventService.emitToRoom(room.id, "game_inactive", {
                completionRate,
                nextTimeout,
                revealedLetter: {
                  index: letterToReveal.index,
                  letter: letterToReveal.letter,
                },
                isGameFinished,
              });

              // Send updated room state to all players
              console.log(
                `Sending updated room state to all players for room ${room.id}`,
              );
              await socketEventService.emitToRoom(room.id, "room", {
                ...room.toJSON(),
                revealedLetterIndex: letterToReveal.index
              });
            } else {
              console.log(`No unsolved letters found for room ${room.id}`);
            }
          }

          // Always schedule next check unless game is finished
          if (room.status === "playing") {
            try {
              const now = Date.now();
              console.log(
                `Scheduling next inactivity check for room ${room.id}:`,
                {
                  nextTimeout,
                  lastActivityTimestamp: room.last_activity_at?.getTime(),
                  currentTime: now,
                  currentTimeISO: new Date(now).toISOString(),
                  lastActivityISO: room.last_activity_at?.toISOString(),
                },
              );

              const nextJob = await gameInactivityQueue.add(
                {
                  roomId: room.id,
                  lastActivityTimestamp: room.last_activity_at?.getTime(),
                },
                {
                  jobId: `game-inactivity-${room.id}-${uuidv4()}`,
                  delay: nextTimeout,
                  removeOnComplete: { count: 1 },
                  removeOnFail: { count: 1 },
                },
              );

              console.log(`Successfully scheduled next inactivity check:`, {
                jobId: nextJob.id,
                roomId: room.id,
                scheduledFor: new Date(now + nextTimeout).toISOString(),
                delayInSeconds: nextTimeout / 1000,
              });
            } catch (error) {
              console.error(
                `Failed to schedule next inactivity check for room ${room.id}:`,
                error,
              );
              // Try one more time with a shorter delay if scheduling failed
              try {
                const retryDelay = Math.max(1000, Math.floor(nextTimeout / 2));
                console.log(`Retrying with shorter delay of ${retryDelay}ms`);
                await gameInactivityQueue.add(
                  {
                    roomId: room.id,
                    lastActivityTimestamp: room.last_activity_at?.getTime(),
                  },
                  {
                    jobId: `game-inactivity-${room.id}-${uuidv4()}-retry`,
                    delay: retryDelay,
                    removeOnComplete: { count: 1 },
                    removeOnFail: { count: 1 },
                  },
                );
              } catch (retryError) {
                console.error(
                  `Retry also failed for room ${room.id}:`,
                  retryError,
                );
                throw retryError;
              }
            }
          } else {
            console.log(
              `Not scheduling next check for room ${room.id} as status is ${room.status}`,
            );
          }
        } else {
          console.log(
            `Skipping inactivity check for room ${room.id} as status is ${room.status}`,
          );
        }

        // Commit the transaction
        await queryRunner.commitTransaction();
      } catch (error) {
        // Only rollback if transaction was started
        if (transactionStarted) {
          try {
            await queryRunner.rollbackTransaction();
          } catch (rollbackError) {
            console.error("Error rolling back transaction:", rollbackError);
          }
        }
        throw error;
      } finally {
        try {
          // Release the queryRunner
          await queryRunner.release();
        } catch (releaseError) {
          console.error("Error releasing query runner:", releaseError);
        }
      }
    },
    {
      connection: {
        host: config.redis.host,
        port: typeof config.redis.port === 'string' ? parseInt(config.redis.port, 10) : config.redis.port,
        username: config.redis.username,
        password: config.redis.password,
      },
      removeOnComplete: { count: 1 },
      removeOnFail: { count: 1 },
    },
  );

  worker.on("completed", (job) => {
    console.log(
      `Game inactivity job ${job.id} completed for room ${job.data.roomId}`,
    );
  });

  worker.on("failed", (job, err) => {
    console.error(
      `Game inactivity job ${job?.id} failed for room ${job?.data?.roomId}:`,
      err,
    );
  });

  return worker;
};
