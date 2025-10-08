#!/usr/bin/env node

import { program } from "commander";
import { DataSource } from "typeorm";
import { loadTestData } from "../scripts/loadTestData";
import { loadIpuzCrosswords } from "../scripts/loadIpuzCrosswords";
import { CrosswordService } from "../services/CrosswordService";
import { AppDataSource } from "../db";
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

program.parse(process.argv);
