#!/usr/bin/env node

import { program } from "commander";
import { DataSource } from "typeorm";
import { loadTestData } from "../scripts/loadTestData";
import { loadIpuzCrosswords } from "../scripts/loadIpuzCrosswords";
import { CrosswordService } from "../services/CrosswordService";
import AppDataSource from "../db";
import { gameInactivityQueue } from "../jobs/queues";
import { v4 as uuidv4 } from "uuid";
import { AuthService } from "../services/AuthService";
import { User } from "../entities/User";

program
  .command("load-crosswords")
  .description("Load crosswords into the database")
  .action(async (dir) => {
    try {
      const dataSource = await AppDataSource.initialize();
      await new CrosswordService(dataSource).loadCrosswords();
      console.log("Crosswords loaded successfully");
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
  .action(async (options) => {
    let dataSource: DataSource | null = null;
    try {
      dataSource = await AppDataSource.initialize();
      const result = await loadIpuzCrosswords(dataSource, {
        directory: options.dir,
        baseDate: options.baseDate,
      });

      console.log(
        `Loaded ${result.inserted} crosswords (${result.skipped} skipped) from ${result.directory}`,
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
  .command("load-test-data")
  .description("Load test data into the database")
  .action(async () => {
    try {
      await loadTestData();
      console.log("Test data loaded successfully");
    } catch (error) {
      console.error("Error loading test data:", error);
    }
  });

program
  .command("add-inactivity-check")
  .description("Add an inactivity check job for a room")
  .requiredOption("-r, --roomId <number>", "Room ID to check")
  .option(
    "-d, --delay <number>",
    "Delay in milliseconds before the check (default: 10000)",
    "10000",
  )
  .action(async (options) => {
    try {
      const { roomId, delay } = options;
      const now = Date.now();

      console.log(
        `Adding inactivity check for room ${roomId} with delay ${delay}ms`,
      );

      const job = await gameInactivityQueue.add(
        "game-inactivity",
        {
          roomId: parseInt(roomId),
          lastActivityTimestamp: now,
        },
        {
          jobId: `game-inactivity-${roomId}-${uuidv4()}`,
          delay: parseInt(delay),
          removeOnComplete: { count: 1 },
          removeOnFail: { count: 1 },
        },
      );

      console.log("Successfully added inactivity check:", {
        jobId: job.id,
        roomId: roomId,
        scheduledFor: new Date(now + parseInt(delay)).toISOString(),
        delay: parseInt(delay),
      });

      process.exit(0);
    } catch (error) {
      console.error("Error adding inactivity check:", error);
      process.exit(1);
    }
  });

program
  .command("kill-inactivity-jobs")
  .description("Kill game inactivity jobs")
  .option(
    "-r, --roomId <number>",
    "Room ID to kill jobs for (if not provided, kills all game inactivity jobs)",
  )
  .action(async (options) => {
    try {
      const { roomId } = options;

      if (roomId) {
        console.log(`Removing inactivity jobs for room ${roomId}`);
        const jobs = await gameInactivityQueue.getJobs([
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

        console.log(
          `Successfully removed ${roomJobs.length} jobs for room ${roomId}`,
        );
      } else {
        console.log("Removing all game inactivity jobs");
        const jobs = await gameInactivityQueue.getJobs([
          "active",
          "waiting",
          "delayed",
        ]);

        for (const job of jobs) {
          await job.remove();
          console.log(`Removed job ${job.id} for room ${job.data.roomId}`);
        }

        console.log(`Successfully removed ${jobs.length} jobs`);
      }

      process.exit(0);
    } catch (error) {
      console.error("Error killing inactivity jobs:", error);
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
    "Start a new game between two players with optional pre-filled board",
  )
  .requiredOption("-p1, --player1 <number>", "First player ID")
  .requiredOption("-p2, --player2 <number>", "Second player ID")
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
    "Start the game inactivity timer",
    false,
  )
  .action(async (options) => {
    let dataSource: DataSource | null = null;
    try {
      dataSource = await AppDataSource.initialize();
      const { player1, player2, difficulty, fill, timer } = options;

      const player1Id = parseInt(player1);
      const player2Id = parseInt(player2);
      const fillPercentage = parseFloat(fill);
      const startTimer = timer === true;

      // Validate fill percentage
      if (fillPercentage < 0 || fillPercentage > 100) {
        console.error("Fill percentage must be between 0 and 100");
        process.exit(1);
      }

      // Validate players exist
      const userRepo = dataSource.getRepository(User);
      const [p1, p2] = await Promise.all([
        userRepo.findOneBy({ id: player1Id }),
        userRepo.findOneBy({ id: player2Id }),
      ]);

      if (!p1) {
        console.error(`Player 1 with ID ${player1Id} not found`);
        process.exit(1);
      }

      if (!p2) {
        console.error(`Player 2 with ID ${player2Id} not found`);
        process.exit(1);
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
      room.players = [p1, p2];
      room.crossword = crossword;
      room.difficulty = difficulty;
      room.type = "1v1";
      room.status = "playing";
      room.scores = { [p1.id]: 0, [p2.id]: 0 };
      room.last_activity_at = new Date();

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

      // Start inactivity timer if requested
      if (startTimer) {
        const { config } = await import("../config/config");
        await gameInactivityQueue.add(
          "game-inactivity",
          {
            roomId: savedRoom.id,
            lastActivityTimestamp: room.last_activity_at.getTime(),
          },
          {
            jobId: `game-inactivity-${savedRoom.id}-${uuidv4()}`,
            delay: config.game.timeout.inactivity.initial,
          },
        );
        console.log(
          `Started inactivity timer with ${config.game.timeout.inactivity.initial}ms delay`,
        );
      }

      console.log("\n✓ Game created successfully!");
      console.log(`  Room ID: ${savedRoom.id}`);
      console.log(
        `  Players: ${p1.username} (ID: ${p1.id}) vs ${p2.username} (ID: ${p2.id})`,
      );
      console.log(`  Difficulty: ${difficulty}`);
      console.log(`  Crossword: ${crossword.title || "Untitled"}`);
      console.log(`  Grid Size: ${crossword.row_size}x${crossword.col_size}`);
      console.log(`  Pre-filled: ${fillPercentage}%`);
      console.log(`  Status: ${savedRoom.status}`);
      console.log(
        `  Inactivity Timer: ${startTimer ? "Started" : "Not started"}`,
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

program.parse(process.argv);
