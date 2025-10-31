import { DataSource, In } from "typeorm";
import { Crossword } from "../entities/Crossword";
import { NotFoundError } from "../errors/api";
import * as fs from "fs";
import * as path from "path";
import { findDir } from "../scripts/findConfigDir";
import { config } from "../config/config";
import { UserCrosswordPack } from "../entities/UserCrosswordPack";

export class CrosswordService {
  private ormConnection: DataSource;

  constructor(ormConnection: DataSource) {
    this.ormConnection = ormConnection;
  }

  async getCrosswords(
    page: number,
    limit: number,
    dow?: string,
    col_size?: number,
    row_size?: number,
  ) {
    const repository = this.ormConnection.getRepository(Crossword);
    const whereConditions: any = {};

    if (dow) {
      whereConditions.dow = dow;
    }

    if (col_size) {
      whereConditions.col_size = col_size;
    }

    if (row_size) {
      whereConditions.row_size = row_size;
    }

    const [items, total] = await repository.findAndCount({
      where: whereConditions,
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  async loadCrosswords(pack: string = "general") {
    const repository = await this.ormConnection.getRepository(Crossword);

    const candidateDirs = [
      process.env.CROSSWORDS_DIR,
      "/crosswords",
    ].filter((dir): dir is string => !!dir);

    let crosswordsDir: string | null = null;
    for (const dir of candidateDirs) {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        crosswordsDir = dir;
        break;
      }
    }

    if (!crosswordsDir) {
      crosswordsDir = findDir("../../", "crosswords");
    }

    if (!crosswordsDir) {
      throw new Error(
        "Crosswords directory not found. Ensure a 'crosswords' folder is available on the server.",
      );
    }
    const crosswords = [];

    const loadFiles = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          loadFiles(filePath);
        } else if (filePath.endsWith(".json")) {
          const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

          if (
            new Date(data["date"]) <
              new Date(config.game.crossword.firstCrosswordDate)
          ) {
            continue;
          }

          data["col_size"] = data["size"]["cols"];
          data["row_size"] = data["size"]["rows"];

          if (data["shadecircles"]) {
            data["shadecircles"] = true;
          } else {
            data["shadecircles"] = false;
          }

          const crossword = { ...data, pack };
          crosswords.push(crossword);
        }
      }
    };

    loadFiles(crosswordsDir);

    for (const crossword of crosswords) {
      const crosswordEntity = repository.create(crossword);
      await repository.save(crosswordEntity);
    }

    console.log("Crosswords loaded successfully");
  }

  async createFoundLettersTemplate(crosswordId: number): Promise<string[]> {
    const repository = this.ormConnection.getRepository(Crossword);
    const crossword = await repository.findOneBy({ id: crosswordId });

    if (!crossword) {
      throw new NotFoundError("Crossword not found");
    }

    return crossword.grid.map((value) => value.replace(/[A-Za-z]/g, "*"));
  }

  async getCrosswordByDifficulty(
    difficulty: string,
    options: { packs?: string[] } = {},
  ): Promise<Crossword | null> {
    const days = this.getDaysByDifficulty(difficulty);

    const packs = options.packs && options.packs.length > 0
      ? Array.from(new Set(options.packs))
      : ["general"];

    const crossword = await this.ormConnection
      .getRepository(Crossword)
      .createQueryBuilder("crossword")
      .where("crossword.dow IN (:...days)", { days })
      .andWhere("crossword.date >= :firstDate", {
        firstDate: new Date(config.game.crossword.firstCrosswordDate),
      })
      .andWhere("crossword.pack IN (:...packs)", { packs })
      .orderBy("RANDOM()")
      .getOne();

    return crossword;
  }

  async getSharedCrosswordPacks(userIds: number[]): Promise<string[]> {
    const basePacks = new Set<string>(["general"]);

    if (userIds.length === 0) {
      return Array.from(basePacks);
    }

    const repository = this.ormConnection.getRepository(UserCrosswordPack);
    const entries = await repository.find({
      where: { userId: In(userIds) },
    });

    if (userIds.length === 1) {
      for (const entry of entries) {
        basePacks.add(entry.pack);
      }
      return Array.from(basePacks);
    }

    const packsByUser = new Map<number, Set<string>>();
    for (const entry of entries) {
      if (!packsByUser.has(entry.userId)) {
        packsByUser.set(entry.userId, new Set());
      }
      packsByUser.get(entry.userId)!.add(entry.pack);
    }

    let shared: Set<string> | null = null;
    for (const userId of userIds) {
      const userPacks = packsByUser.get(userId);
      if (!userPacks) {
        shared = null;
        break;
      }
      if (!shared) {
        shared = new Set(userPacks);
      } else {
        shared = new Set(
          [...shared].filter((pack) => userPacks.has(pack)),
        );
      }
      if (shared.size === 0) {
        break;
      }
    }

    if (shared) {
      for (const pack of shared) {
        basePacks.add(pack);
      }
    }

    return Array.from(basePacks);
  }

  private getDaysByDifficulty(difficulty: string): string[] {
    switch (difficulty.toLowerCase()) {
      case "easy":
        return ["Monday", "Tuesday"];
      case "medium":
        return ["Wednesday", "Thursday"];
      case "hard":
        return ["Friday", "Saturday"];
      default:
        throw new NotFoundError("Invalid difficulty");
    }
  }

  checkGuess(
    crossword: Crossword,
    coordinates: { x: number; y: number },
    guess: string,
  ): boolean {
    const guessPosition = coordinates.x * crossword.col_size + coordinates.y;
    try {
      return (
        crossword.grid[guessPosition].toUpperCase() === guess.toUpperCase()
      );
    } catch (e) {
      throw new NotFoundError("Invalid coordinates");
    }
  }
}
