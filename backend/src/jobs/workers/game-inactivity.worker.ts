import { Worker } from "bullmq";
import { config } from "../../config/config";
import { DataSource } from "typeorm";
import { Room } from "../../entities/Room";
import { NotFoundError } from "../../errors/api";
import { FastifyInstance } from "fastify";
import { createSocketEventService } from "../../services/SocketEventService";
import { gameInactivityQueue } from "../queues";

/**
 * Find a random unsolved letter position in the puzzle
 * @param foundLetters Array of found letters where "*" represents unsolved
 * @param crossword The crossword puzzle data
 * @returns Position and letter, or null if no unsolved letters
 */
function findRandomUnsolvedLetter(foundLetters: string[], crossword: any): { index: number, letter: string } | null {
    // Get all unsolved positions (marked with "*")
    const unsolvedPositions = foundLetters
        .map((letter, index) => ({ letter, index }))
        .filter(({ letter }) => letter === "*");

    if (unsolvedPositions.length === 0) return null;

    // Pick a random unsolved position
    const randomPosition = unsolvedPositions[Math.floor(Math.random() * unsolvedPositions.length)];

    // Get the actual letter from the crossword solution
    const solution = crossword.solution.split("");
    const letter = solution[randomPosition.index];

    return {
        index: randomPosition.index,
        letter
    };
}

/**
 * Calculate the dynamic timeout interval based on puzzle completion
 * @param completionRate Percentage of puzzle completed (0 to 1)
 * @returns Timeout in milliseconds
 */
function calculateDynamicTimeout(completionRate: number): number {
    const { initial, minimum, accelerationRate, completionStep } = config.game.timeout.inactivity;

    // Calculate how many completion steps we've passed
    const steps = Math.floor(completionRate / completionStep);

    // Calculate the reduction factor based on steps
    // Each step reduces the timeout by accelerationRate
    const reductionFactor = Math.pow(1 - accelerationRate, steps);

    // Calculate the new timeout
    const timeout = Math.max(
        minimum,
        initial * reductionFactor
    );

    return Math.round(timeout);
}

export const createGameInactivityWorker = (dataSource: DataSource, fastify: FastifyInstance) => {
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
            const roomRepository = dataSource.getRepository(Room);

            const room = await roomRepository.findOne({
                where: { id: job.data.roomId },
                relations: ["players", "crossword"],
            });

            if (!room) {
                throw new NotFoundError("Room not found");
            }

            // Only process if the game is still active
            if (room.status === "playing") {
                // Calculate completion rate (number of found letters / total letters)
                const totalLetters = room.found_letters.length;
                const foundLetters = room.found_letters.filter(letter => letter !== "*").length;
                const completionRate = foundLetters / totalLetters;

                // Calculate the next timeout interval
                const nextTimeout = calculateDynamicTimeout(completionRate);

                console.log("Next timeout:", nextTimeout);

                // If there's been no activity since the last check
                if (job.data.lastActivityTimestamp === room.last_activity_at?.getTime()) {
                    // Find a random unsolved letter to reveal
                    const letterToReveal = findRandomUnsolvedLetter(room.found_letters, room.crossword);

                    console.log("Letter to reveal:", letterToReveal);

                    if (letterToReveal) {
                        // Reveal the letter
                        room.found_letters[letterToReveal.index] = letterToReveal.letter;
                        room.last_activity_at = new Date();
                        await roomRepository.save(room);

                        // Notify players about inactivity and revealed letter
                        await socketEventService.emitToRoom(room.id, "game_inactive", {
                            message: "Due to inactivity, a letter has been revealed!",
                            completionRate,
                            nextTimeout,
                            revealedLetter: {
                                index: letterToReveal.index,
                                letter: letterToReveal.letter
                            }
                        });

                        // Send updated room state to all players
                        console.log("Sending updated room state to all players");
                        await socketEventService.emitToRoom(room.id, "room", room.toJSON());
                    }
                }


                // Schedule the next check with the dynamic timeout
                await gameInactivityQueue.add(
                    "game-inactivity",
                    {
                        roomId: room.id,
                        lastActivityTimestamp: room.last_activity_at?.getTime(),
                    },
                    {
                        jobId: `game-inactivity-${room.id}`,
                        delay: nextTimeout,
                    }
                );
            }
        },
        {
            connection: {
                host: config.redis.host,
                port: config.redis.port,
                password: config.redis.password,
            },
        }
    );

    worker.on("failed", (job, err) => {
        console.error(`Game inactivity job ${job?.id} failed:`, err);
    });

    return worker;
};
