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
import { RedisService } from "../../services/RedisService";
import { RoomService } from "../../services/RoomService";
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
  const redisService = new RedisService();
  const roomService = new RoomService(dataSource);

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
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // First get and lock just the room
        const room = await queryRunner.manager
          .getRepository(Room)
          .createQueryBuilder("room")
          .where("room.id = :roomId", { roomId: job.data.roomId })
          .getOne();

        if (!room) {
          await queryRunner.rollbackTransaction();
          throw new NotFoundError("Room not found");
        }

        // Now get the related crossword data and players in a separate query
        const roomWithRelations = await queryRunner.manager
          .getRepository(Room)
          .createQueryBuilder("room")
          .leftJoinAndSelect("room.crossword", "crossword")
          .leftJoinAndSelect("room.players", "players")
          .where("room.id = :roomId", { roomId: room.id })
          .getOne();

        // Merge all the relations into our locked room object
        Object.assign(room, {
          crossword: roomWithRelations.crossword,
          players: roomWithRelations.players,
        });

        let cachedGameInfo = await redisService.getGame(room.id.toString());
        if (!cachedGameInfo) {
          // handle creating new cache
          cachedGameInfo = room.createRoomCache();
        }

        // Only process if the game is still active
        if (room.status === "playing") {
          // Calculate completion rate (number of found letters / total letters)
          const totalLetters = cachedGameInfo.foundLetters.length;
          const foundLetters = cachedGameInfo.foundLetters.filter((letter) =>
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
          if (!cachedGameInfo.lastActivityAt) {
            console.log(
              `Room ${room.id} has no last_activity_at, setting to now`,
            );
            cachedGameInfo.lastActivityAt = Date.now();
            room.last_activity_at = new Date(cachedGameInfo.lastActivityAt);
            await queryRunner.manager.save(room);
          }

          // Reveal only if no new activity has occurred since this job was scheduled
          const isInactive = job.data.lastActivityTimestamp !== undefined &&
            cachedGameInfo.lastActivityAt !== undefined &&
            job.data.lastActivityTimestamp === cachedGameInfo.lastActivityAt;

          if (isInactive) {
            console.log(
              `No activity detected for room ${room.id} since last check`,
            );
            // Find a random unsolved letter to reveal
            const letterToReveal = findRandomUnsolvedLetter(
              cachedGameInfo.foundLetters,
              room.crossword,
            );

            if (letterToReveal) {
              // Reveal the letter
              cachedGameInfo.foundLetters[letterToReveal.index] =
                letterToReveal.letter;
              cachedGameInfo.lastActivityAt = Date.now();

              // Check if all letters have been revealed
              const isGameFinished = !cachedGameInfo.foundLetters.includes("*");
              console.log(
                `Room ${room.id} game finished status:`,
                isGameFinished,
              );
              if (isGameFinished) {
                await roomService.onGameEnd(room);
              }

              // Save moved after state updates below

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

              room.last_activity_at = new Date(cachedGameInfo.lastActivityAt);
              room.found_letters = cachedGameInfo.foundLetters;
              room.scores = cachedGameInfo.scores;
              room.markModified();
              await queryRunner.manager.save(room);

              // Send updated room state to all players
              console.log(
                `Sending updated room state to all players for room ${room.id}`,
              );
              await socketEventService.emitToRoom(room.id, "room", {
                ...room.toJSON(
                  cachedGameInfo.foundLetters,
                  cachedGameInfo.scores,
                ),
                revealedLetterIndex: letterToReveal.index,
              });
            } else {
              console.log(`No unsolved letters found for room ${room.id}`);
            }
          }

          // Always schedule next check unless game is finished
          // This ensures we keep checking even if something went wrong
          if (room.status === "playing") {
            try {
              const now = Date.now();
              console.log(
                `Scheduling next inactivity check for room ${room.id}:`,
                {
                  nextTimeout,
                  lastActivityTimestamp: cachedGameInfo.lastActivityAt,
                  currentTime: now,
                  currentTimeISO: new Date(now).toISOString(),
                  lastActivityISO: room.last_activity_at?.toISOString(),
                },
              );

              const nextJob = await gameInactivityQueue.add(
                "game-inactivity",
                {
                  roomId: room.id,
                  lastActivityTimestamp: cachedGameInfo.lastActivityAt,
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
                  "game-inactivity",
                  {
                    roomId: room.id,
                    lastActivityTimestamp: cachedGameInfo.lastActivityAt,
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
        redisService.cacheGame(room.id.toString(), cachedGameInfo);
        await queryRunner.commitTransaction();
      } catch (error) {
        // Rollback transaction on error
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        // Release the queryRunner
        await queryRunner.release();
      }
    },
    {
      connection: config.redis.default,
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
