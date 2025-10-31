#!/usr/bin/env node

import "dotenv/config";
import { program } from "commander";
import {
  Between,
  DataSource,
  Equal,
  FindOperator,
  IsNull,
  LessThan,
  MoreThan,
  Not,
} from "typeorm";
import { loadIpuzCrosswords } from "../scripts/loadIpuzCrosswords";
import { CrosswordService } from "../services/CrosswordService";
import AppDataSource from "../db";
import { v4 as uuidv4 } from "uuid";
import { AuthService } from "../services/AuthService";
import { User } from "../entities/User";
import { JoinMethod, Room } from "../entities/Room";
import { Crossword } from "../entities/Crossword";
import { Friend } from "../entities/Friend";
import { Support } from "../entities/Support";
import { CrosswordRating } from "../entities/CrosswordRating";
import {
  avgGamesPerUserPerWeek,
  churnRate,
  printReport,
  retentionDays,
  usersWithMultipleGames,
} from "./reportUtils";

program
  .command("load-crosswords")
  .description("Load crosswords into the database")
  .option(
    "-p, --pack <string>",
    "Pack identifier to assign to the loaded crosswords",
    "general",
  )
  .action(async (options) => {
    try {
      const dataSource = await AppDataSource.initialize();
      const pack = options.pack ?? "general";
      await new CrosswordService(dataSource).loadCrosswords(pack);
      console.log(`Crosswords loaded successfully into pack "${pack}"`);
    } catch (error) {
      console.error("Error loading crosswords:", error);
    }
  });

program
  .command("load-ipuz-crosswords")
  .description("Load IPUZ crosswords into the database")
  .option("-d, --dir <path>", "Directory that contains .ipuz files")
  .option(
    "-b, --base-date <date>",
    "Base date to assign to the first crossword (YYYY-MM-DD)",
    "2024-01-01",
  )
  .option(
    "-p, --pack <string>",
    "Pack identifier to assign to the loaded crosswords",
    "general",
  )
  .action(async (options) => {
    let dataSource: DataSource | null = null;
    try {
      dataSource = await AppDataSource.initialize();
      const result = await loadIpuzCrosswords(dataSource, {
        directory: options.dir,
        baseDate: options.baseDate,
        pack: options.pack,
      });

      console.log(
        `Loaded ${result.inserted} crosswords (${result.skipped} skipped) from ${result.directory} into pack "${options.pack ?? "general"}"`,
      );
      await dataSource.destroy();
      process.exit(0);
    } catch (error) {
      if (dataSource) {
        await dataSource.destroy().catch(() => {});
      }
      console.error("Error loading IPUZ crosswords:", error);
      process.exit(1);
    }
  });

program
  .command("add-auto-reveal-tick")
  .alias("add-inactivity-check")
  .description("Schedule an auto-reveal tick for a room")
  .requiredOption("-r, --roomId <number>", "Room ID to check")
  .option(
    "-d, --delay <number>",
    "Delay in milliseconds before the auto-reveal tick (default: 10000)",
    "10000",
  )
  .action(async (options) => {
    try {
      const { roomId, delay } = options;
      const now = Date.now();
      const { gameAutoRevealQueue } = await import("../jobs/queues");

      console.log(
        `Adding auto-reveal tick for room ${roomId} with delay ${delay}ms`,
      );

      const job = await gameAutoRevealQueue.add(
        "game-auto-reveal",
        {
          roomId: parseInt(roomId),
          lastActivityTimestamp: now,
        },
        {
          jobId: `game-auto-reveal-${roomId}-${uuidv4()}`,
          delay: parseInt(delay),
          removeOnComplete: { count: 1 },
          removeOnFail: { count: 1 },
        },
      );

      console.log("Successfully added auto-reveal tick:", {
        jobId: job.id,
        roomId: roomId,
        scheduledFor: new Date(now + parseInt(delay)).toISOString(),
        delay: parseInt(delay),
      });

      process.exit(0);
    } catch (error) {
      console.error("Error scheduling auto-reveal tick:", error);
      process.exit(1);
    }
  });

program
  .command("kill-auto-reveal-jobs")
  .alias("kill-inactivity-jobs")
  .description("Remove scheduled auto-reveal jobs")
  .option(
    "-r, --roomId <number>",
    "Room ID to clear jobs for (default clears all auto-reveal jobs)",
  )
  .action(async (options) => {
    try {
      const { roomId } = options;
      const { gameAutoRevealQueue } = await import("../jobs/queues");

      if (roomId) {
        console.log(`Removing auto-reveal jobs for room ${roomId}`);
        const jobs = await gameAutoRevealQueue.getJobs([
          "active",
          "waiting",
          "delayed",
        ]);
        const roomJobs = jobs.filter((job) =>
          job.data.roomId === parseInt(roomId)
        );

        for (const job of roomJobs) {
          await job.remove();
          console.log(`Removed job ${job.id} for room ${roomId}`);
        }

        console.log(`Removed ${roomJobs.length} auto-reveal jobs for room ${roomId}`);
      } else {
        console.log("Removing all auto-reveal jobs");
        const jobs = await gameAutoRevealQueue.getJobs([
          "active",
          "waiting",
          "delayed",
        ]);

        for (const job of jobs) {
          await job.remove();
          console.log(`Removed job ${job.id} for room ${job.data.roomId}`);
        }

        console.log(`Successfully removed ${jobs.length} auto-reveal jobs`);
      }

      process.exit(0);
    } catch (error) {
      console.error("Error removing auto-reveal jobs:", error);
      process.exit(1);
    }
  });

program
  .command("change-password")
  .description("Change a user's password")
  .requiredOption("-e, --email <string>", "User's email")
  .requiredOption("-p, --password <string>", "New password")
  .action(async (options) => {
    try {
      const dataSource = await AppDataSource.initialize();
      const authService = new AuthService(dataSource);

      // Find user by email
      const user = await dataSource.getRepository(User).findOne({
        where: { email: options.email },
      });

      if (!user) {
        console.error("User not found");
        process.exit(1);
      }

      await authService.updatePassword(user.id, options.password);
      console.log(`Successfully changed password for user ${options.email}`);
      process.exit(0);
    } catch (error) {
      console.error("Error changing password:", error);
      process.exit(1);
    }
  });

program
  .command("start-game")
  .description(
    "Start a new game with optional pre-filled board",
  )
  .requiredOption("-p1, --player1 <number>", "First player ID")
  .option(
    "-p2, --player2 <number>",
    "Second player ID (not required for time_trial)",
  )
  .option(
    "-d, --difficulty <string>",
    "Difficulty level (easy, medium, hard)",
    "easy",
  )
  .option(
    "-f, --fill <number>",
    "Percentage of squares to pre-fill (0-100)",
    "0",
  )
  .option(
    "-t, --timer",
    "Start the auto-reveal system immediately",
    false,
  )
  .option(
    "-g, --game-type <string>",
    "Game type (1v1, 2v2, free4all, time_trial)",
    "1v1",
  )
  .action(async (options) => {
    let dataSource: DataSource | null = null;
    try {
      dataSource = await AppDataSource.initialize();
      const { player1, player2, difficulty, fill, timer, gameType } = options;

      const player1Id = parseInt(player1);
      const player2Id = player2 ? parseInt(player2) : null;
      const fillPercentage = parseFloat(fill);
      const startTimer = timer === true;

      // Validate game type
      const validGameTypes = ["1v1", "2v2", "free4all", "time_trial"];
      if (!validGameTypes.includes(gameType)) {
        console.error(
          `Invalid game type. Must be one of: ${validGameTypes.join(", ")}`,
        );
        process.exit(1);
      }

      // Validate fill percentage
      if (fillPercentage < 0 || fillPercentage > 100) {
        console.error("Fill percentage must be between 0 and 100");
        process.exit(1);
      }

      // For time_trial, player2 is not required
      if (gameType === "time_trial" && player2Id) {
        console.error(
          "Time trial games are single player. Do not specify player2.",
        );
        process.exit(1);
      }

      // For non-time_trial games, player2 is required
      if (gameType !== "time_trial" && !player2Id) {
        console.error(`Player 2 is required for ${gameType} games`);
        process.exit(1);
      }

      // Validate players exist
      const userRepo = dataSource.getRepository(User);
      const p1 = await userRepo.findOneBy({ id: player1Id });

      if (!p1) {
        console.error(`Player 1 with ID ${player1Id} not found`);
        process.exit(1);
      }

      let p2 = null;
      if (player2Id) {
        p2 = await userRepo.findOneBy({ id: player2Id });
        if (!p2) {
          console.error(`Player 2 with ID ${player2Id} not found`);
          process.exit(1);
        }
      }

      // Create the game using RoomService
      const { RoomService } = await import("../services/RoomService");
      const roomService = new RoomService(dataSource);
      const crosswordService = new CrosswordService(dataSource);

      // Get a crossword for the difficulty
      const crossword = await crosswordService.getCrosswordByDifficulty(
        difficulty,
      );

      if (!crossword) {
        console.error(`No crossword found for difficulty: ${difficulty}`);
        process.exit(1);
      }

      // Create the room manually to have control over initialization
      const { Room } = await import("../entities/Room");
      const room = new Room();
      room.players = gameType === "time_trial" ? [p1] : [p1, p2];
      room.crossword = crossword;
      room.difficulty = difficulty;
      room.type = gameType;
      room.status = "playing";
      room.scores = gameType === "time_trial"
        ? { [p1.id]: 0 }
        : { [p1.id]: 0, [p2.id]: 0 };
      room.last_activity_at = new Date();
      room.join_type = JoinMethod.CLI;

      // Create found_letters template
      const foundLetters = await crosswordService.createFoundLettersTemplate(
        crossword.id,
      );

      // Pre-fill squares if requested
      if (fillPercentage > 0) {
        const totalSquares = foundLetters.filter((char) => char === "*").length;
        const squaresToFill = Math.floor((totalSquares * fillPercentage) / 100);

        // Get indices of all unfilled squares
        const unfilledIndices: number[] = [];
        foundLetters.forEach((char, index) => {
          if (char === "*") {
            unfilledIndices.push(index);
          }
        });

        // Randomly select squares to fill
        const shuffled = unfilledIndices.sort(() => Math.random() - 0.5);
        const indicesToFill = shuffled.slice(0, squaresToFill);

        // Fill the selected squares with correct letters
        indicesToFill.forEach((index) => {
          foundLetters[index] = crossword.grid[index];
        });

        console.log(
          `Pre-filled ${squaresToFill} out of ${totalSquares} squares (${fillPercentage}%)`,
        );
      }

      room.found_letters = foundLetters;

      // Save the room
      const savedRoom = await dataSource.getRepository(Room).save(room);

      // Start auto-reveal system if requested
      if (startTimer) {
        const { config } = await import("../config/config");
        const { gameAutoRevealQueue } = await import("../jobs/queues");
        await gameAutoRevealQueue.add(
          "game-auto-reveal",
          {
            roomId: savedRoom.id,
            lastActivityTimestamp: room.last_activity_at.getTime(),
          },
          {
            jobId: `game-auto-reveal-${savedRoom.id}-${uuidv4()}`,
            delay: config.game.timeout.autoReveal.initial,
          },
        );
        console.log(
          `Started auto-reveal cycle with ${config.game.timeout.autoReveal.initial}ms delay`,
        );
      }

      console.log("\n✓ Game created successfully!");
      console.log(`  Room ID: ${savedRoom.id}`);
      console.log(`  Game Type: ${gameType}`);
      if (gameType === "time_trial") {
        console.log(`  Player: ${p1.username} (ID: ${p1.id})`);
      } else {
        console.log(
          `  Players: ${p1.username} (ID: ${p1.id}) vs ${p2.username} (ID: ${p2.id})`,
        );
      }
      console.log(`  Difficulty: ${difficulty}`);
      console.log(`  Crossword: ${crossword.title || "Untitled"}`);
      console.log(`  Grid Size: ${crossword.row_size}x${crossword.col_size}`);
      console.log(`  Pre-filled: ${fillPercentage}%`);
      console.log(`  Status: ${savedRoom.status}`);
      console.log(
        `  Auto-Reveal System: ${startTimer ? "Started" : "Not started"}`,
      );

      await dataSource.destroy();
      process.exit(0);
    } catch (error) {
      if (dataSource) {
        await dataSource.destroy().catch(() => {});
      }
      console.error("Error starting game:", error);
      process.exit(1);
    }
  });

program
  .command("report")
  .option("-t --time <time>", "time to start from", "all")
  .description(
    "Get a report on number of players, games played, etc..",
  )
  .action(async (options) => {
    let { time } = options;
    if (time === "all") {
      time = new Date("2020-01-01");
    } else {
      time = new Date(time);
    }

    try {
      let dataSource: DataSource | null = null;
      dataSource = await AppDataSource.initialize();

      const users = dataSource.getRepository(User);
      const rooms = dataSource.getRepository(Room);
      const crosswords = dataSource.getRepository(Crossword);
      const ratings = dataSource.getRepository(CrosswordRating);
      const friends = dataSource.getRepository(Friend);
      const support = dataSource.getRepository(Support);

      // users who have played more than one game
      // users who have played a game at least a week apart
      // average games a user plays
      // friends made
      // games started by challenge vs random

      const userData = {
        newUsers: await users.count({
          where: { created_at: MoreThan(time) },
        }),
        friendsMade: await friends.count({
          where: { acceptedAt: Not(IsNull()), createdAt: MoreThan(time) },
        }),
        usersWithMultipleGames: await usersWithMultipleGames(
          time,
          AppDataSource,
        ),
        avgGamesPerUserPerWeek: await avgGamesPerUserPerWeek(
          time,
          AppDataSource,
        ),
        retention: {
          retention1: await retentionDays(1, time, AppDataSource),
          retention7: await retentionDays(7, time, AppDataSource),
          retention30: await retentionDays(30, time, AppDataSource),
          churnRate: await churnRate(time, AppDataSource),
        },
      };

      const ratingsData = {
        ratingsSubmitted: await ratings.count({
          where: { created_at: MoreThan(time) },
        }),
        low: await ratings.count({
          where: { qualityRating: LessThan(3), created_at: MoreThan(time) },
        }),
        mid: await ratings.count({
          where: { qualityRating: 3, created_at: MoreThan(time) },
        }),
        high: await ratings.count({
          where: { qualityRating: MoreThan(3), created_at: MoreThan(time) },
        }),
      };

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const gameData = {
        totalGamesFinished: await rooms.count({
          where: { completed_at: Not(IsNull()), created_at: MoreThan(time) },
        }),
        gamesStuck: await rooms.count({
          where: {
            completed_at: IsNull(),
            created_at: MoreThan(oneHourAgo),
          },
        }),
      };

      const supportData = {
        supportRequests: await support.count({
          where: { type: "support", created_at: MoreThan(time) },
        }),
        ideasSubmitted: await support.count({
          where: { type: "suggestion", created_at: MoreThan(time) },
        }),
      };

      printReport({
        users: userData,
        games: gameData,
        ratings: ratingsData,
        support: supportData,
      });
    } catch (error) {
    }

    process.exit(0);
  });

program.parse(process.argv);
