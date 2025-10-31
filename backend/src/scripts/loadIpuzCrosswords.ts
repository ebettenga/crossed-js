import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DataSource } from "typeorm";
import { Crossword } from "../entities/Crossword";
import { ipuzToCrossword } from "../utils/ipuzToCrossword";

export type LoadIpuzCrosswordsOptions = {
  directory?: string;
  baseDate?: string;
  pack?: string;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
});

const parseOffsetFromFilename = (
  filename: string,
  fallback: number,
): number => {
  const match = filename.match(/(\d+)/);
  if (!match) {
    return fallback;
  }

  const parsed = parseInt(match[1], 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed - 1;
};

export const loadIpuzCrosswords = async (
  dataSource: DataSource,
  options: LoadIpuzCrosswordsOptions = {},
) => {
  const repository = dataSource.getRepository(Crossword);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const resolvedDirectory = options.directory
    ? path.resolve(options.directory)
    : path.resolve(__dirname, "../../../public_crosswords");

  if (!fs.existsSync(resolvedDirectory)) {
    throw new Error(`Directory not found: ${resolvedDirectory}`);
  }

  const directoryStats = fs.statSync(resolvedDirectory);
  if (!directoryStats.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolvedDirectory}`);
  }

  const files = fs
    .readdirSync(resolvedDirectory)
    .filter((file) => file.toLowerCase().endsWith(".ipuz"))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    return {
      directory: resolvedDirectory,
      inserted: 0,
      skipped: 0,
      total: 0,
    };
  }

  const baseDateInput = options.baseDate ?? "2024-01-01";
  const baseDate = new Date(baseDateInput);

  if (Number.isNaN(baseDate.getTime())) {
    throw new Error(`Invalid base date provided: ${baseDateInput}`);
  }

  const baseTime = Date.UTC(
    baseDate.getUTCFullYear(),
    baseDate.getUTCMonth(),
    baseDate.getUTCDate(),
  );

  let inserted = 0;
  let skipped = 0;
  const pack = options.pack ?? "general";

  for (const [index, file] of files.entries()) {
    const offset = parseOffsetFromFilename(file, index);
    const currentTime = baseTime + offset * DAY_IN_MS;
    const currentDate = new Date(currentTime);
    const dow = weekdayFormatter.format(currentDate);

    const filePath = path.join(resolvedDirectory, file);
    const contents = fs.readFileSync(filePath, "utf-8");
    const ipuz = JSON.parse(contents);

    const crosswordData = ipuzToCrossword(ipuz, {
      date: currentDate,
      dow,
    });
    crosswordData.pack = pack;

    if (!crosswordData.title || crosswordData.title.length === 0) {
      crosswordData.title = path.parse(file).name;
    }

    const existing = await repository.findOne({
      where: {
        title: crosswordData.title ?? null,
        date: crosswordData.date ?? null,
      },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    const entity = repository.create(crosswordData);
    await repository.save(entity);
    inserted += 1;
  }

  return {
    directory: resolvedDirectory,
    inserted,
    skipped,
    total: files.length,
  };
};
