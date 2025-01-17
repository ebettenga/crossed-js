import { DataSource } from "typeorm";
import { Crossword } from "../entities/Crossword";
import { Room } from "../entities/Room";
import { NotFoundError } from "../errors/api";
import * as fs from "fs";
import * as path from "path";
import { findDir } from "../scripts/findConfigDir";
import { config } from "../config/config";

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

  async loadCrosswords() {
    const repository = await this.ormConnection.getRepository(Crossword);

    const crosswordsDir = findDir("../../", "crosswords");
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

          const crossword = { ...data };
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

  async getCrosswordByDifficulty(difficulty: string): Promise<Crossword> {
    const days = this.getDaysByDifficulty(difficulty);
    const crossword = await this.ormConnection
      .getRepository(Crossword)
      .createQueryBuilder("crossword")
      .where("crossword.dow IN (:...days)", { days })
      .andWhere("crossword.date >= :firstDate", {
        firstDate: new Date(config.game.crossword.firstCrosswordDate),
      })
      .orderBy("RANDOM()")
      .getOne();

    return crossword;
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
    room: Room,
    coordinates: { x: number; y: number },
    guess: string,
  ): boolean {
    const crossword = room.crossword;
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
