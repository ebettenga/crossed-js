import { DataSource, In, Repository } from "typeorm";
import AdmZip from "adm-zip";
import { Crossword } from "../entities/Crossword";
import { NotFoundError } from "../errors/api";
import * as fs from "fs";
import * as path from "path";
import { findDir } from "../scripts/findConfigDir";
import { config } from "../config/config";
import { UserCrosswordPack } from "../entities/UserCrosswordPack";

const DEFAULT_BATCH_SIZE = 200;

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

  async loadCrosswords(pack: string = "general", sourceOverride?: string) {
    const repository = await this.ormConnection.getRepository(Crossword);
    const source = sourceOverride ?? config.game.crossword.source ?? null;

    const shouldForceRemote = Boolean(
      sourceOverride && source && this.isUrl(source),
    );

    let crosswords: any[];

    if (!shouldForceRemote) {
      // Prefer local crossword directories when available (e.g., tests, offline runs).
      const resolvedLocal = this.resolveLocalDirectory(
        source && !this.isUrl(source) ? source : null,
      );

      if (resolvedLocal) {
        crosswords = await this.loadCrosswordsFromLocal(resolvedLocal, pack);
      } else if (source && this.isUrl(source)) {
        crosswords = await this.loadCrosswordsFromRemote(source, pack);
      } else {
        crosswords = await this.loadCrosswordsFromLocal(source, pack);
      }
    } else {
      crosswords = await this.loadCrosswordsFromRemote(source, pack);
    }

    const {
      crosswordsToInsert,
      skippedExisting,
    } = await this.filterExistingCrosswords(repository, crosswords, pack);

    await this.saveCrosswordsInBatches(
      repository,
      crosswordsToInsert,
      DEFAULT_BATCH_SIZE,
    );

    console.log(
      `Crosswords loaded successfully: inserted ${crosswordsToInsert.length}, skipped ${skippedExisting} existing entries`,
    );
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

  private async loadCrosswordsFromLocal(
    source: string | null,
    pack: string,
  ): Promise<any[]> {
    const crosswordsDir = this.resolveLocalDirectory(source);
    if (!crosswordsDir) {
      throw new Error(
        "Crosswords directory not found. Ensure a 'crosswords' folder is available on the server.",
      );
    }

    const collected: any[] = [];
    const traverse = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          traverse(entryPath);
          continue;
        }
        if (!entry.name.endsWith(".json")) {
          continue;
        }
        const data = JSON.parse(fs.readFileSync(entryPath, "utf-8"));
        const transformed = this.transformCrosswordPayload(data, pack);
        if (transformed) {
          collected.push(transformed);
        }
      }
    };

    traverse(crosswordsDir);
    return collected;
  }

  private resolveLocalDirectory(source: string | null): string | null {
    const candidates: string[] = [];

    if (source && !this.isUrl(source)) {
      candidates.push(source);
    }

    const envDir = process.env.CROSSWORDS_DIR;
    if (envDir) {
      candidates.push(envDir);
    }
    candidates.push("/crosswords");

    for (const candidate of candidates) {
      const resolved = path.isAbsolute(candidate)
        ? candidate
        : path.resolve(candidate);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        return resolved;
      }
    }

    return findDir("../../", "crosswords");
  }

  private async loadCrosswordsFromRemote(
    source: string,
    pack: string,
  ): Promise<any[]> {
    const githubInfo = this.parseGithubTreeUrl(source);
    if (!githubInfo) {
      throw new Error(
        "Unsupported remote crossword source. Provide a GitHub tree URL.",
      );
    }

    const fetchFn = this.ensureFetch();
    return await this.collectGithubCrosswordsFromArchive(
      githubInfo,
      pack,
      fetchFn,
    );
  }

  private async collectGithubCrosswordsFromArchive(
    info: {
      owner: string;
      repo: string;
      ref: string;
      path: string;
    },
    pack: string,
    fetchFn: (input: any, init?: any) => Promise<any>,
  ): Promise<any[]> {
    const archiveBuffer = await this.downloadGithubArchive(info, fetchFn);
    const zip = new AdmZip(archiveBuffer);
    const entries = zip.getEntries();

    if (entries.length === 0) {
      return [];
    }

    const rootDir = this.getArchiveRoot(entries);
    const normalizedTarget = this.normalizeArchiveTarget(rootDir, info.path);
    const collected: any[] = [];

    for (const entry of entries) {
      if (entry.isDirectory) {
        continue;
      }
      const entryPath = entry.entryName.replace(/\\/g, "/");
      if (!entryPath.startsWith(normalizedTarget)) {
        continue;
      }
      if (!entryPath.endsWith(".json")) {
        continue;
      }

      const fileContent = entry.getData().toString("utf-8");
      try {
        const parsed = JSON.parse(fileContent);
        const transformed = this.transformCrosswordPayload(parsed, pack);
        if (transformed) {
          collected.push(transformed);
        }
      } catch (error) {
        console.warn(
          `Failed to parse crossword file ${entryPath}: ${String(error)}`,
        );
      }
    }

    return collected;
  }

  private ensureFetch(): (input: any, init?: any) => Promise<any> {
    const fetchFn = globalThis.fetch;
    if (!fetchFn) {
      throw new Error("Fetch API is not available in this runtime.");
    }
    return fetchFn.bind(globalThis);
  }

  private transformCrosswordPayload(data: any, pack: string): any | null {
    const firstDate = new Date(config.game.crossword.firstCrosswordDate);
    const crosswordDate = data["date"] ? new Date(data["date"]) : null;

    if (crosswordDate && crosswordDate < firstDate) {
      return null;
    }

    if (crosswordDate) {
      data["date"] = crosswordDate;
    }

    if (data["size"]) {
      data["col_size"] = data["size"]["cols"];
      data["row_size"] = data["size"]["rows"];
    }

    data["shadecircles"] = !!data["shadecircles"];

    return { ...data, pack };
  }

  private async downloadGithubArchive(
    info: {
      owner: string;
      repo: string;
      ref: string;
    },
    fetchFn: (input: any, init?: any) => Promise<any>,
  ): Promise<Buffer> {
    const archiveUrl = new URL(
      `https://codeload.github.com/${info.owner}/${info.repo}/zip/${info.ref}`,
    );

    const headers: Record<string, string> = {
      "User-Agent": "crossed-crossword-loader",
      Accept: "application/zip",
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetchFn(archiveUrl.toString(), { headers });
    if (!response.ok) {
      throw new Error(
        `Failed to download crossword archive from GitHub (${response.status} ${response.statusText})`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private getArchiveRoot(entries: AdmZip.IZipEntry[]): string {
    for (const entry of entries) {
      const name = entry.entryName.replace(/\\/g, "/");
      if (!name.includes("/")) {
        continue;
      }
      const [root] = name.split("/");
      if (root) {
        return root;
      }
    }
    return "";
  }

  private normalizeArchiveTarget(
    rootDir: string,
    relativePath: string,
  ): string {
    const trimmedRoot = rootDir ? `${rootDir.replace(/\\/g, "/")}/` : "";
    const cleanedRelative = relativePath
      ? relativePath.replace(/\\/g, "/").replace(/^\//, "")
      : "";

    return `${trimmedRoot}${cleanedRelative ? `${cleanedRelative}/` : ""}`;
  }

  private parseGithubTreeUrl(urlString: string):
    | { owner: string; repo: string; ref: string; path: string }
    | null {
    try {
      const url = new URL(urlString);
      if (!/github\.com$/.test(url.hostname)) {
        return null;
      }
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length < 5 || segments[2] !== "tree") {
        return null;
      }
      const [owner, repo, _tree, ref, ...pathParts] = segments;
      return {
        owner,
        repo,
        ref,
        path: pathParts.join("/"),
      };
    } catch {
      return null;
    }
  }

  private isUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return !!parsed.protocol && !!parsed.hostname;
    } catch {
      return false;
    }
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

  private async filterExistingCrosswords(
    repository: Repository<Crossword>,
    crosswords: any[],
    pack: string,
  ): Promise<{ crosswordsToInsert: any[]; skippedExisting: number }> {
    const existing = await repository.find({
      where: { pack },
      select: ["id", "pack", "date", "title"],
    });

    const existingKeys = new Set(
      existing
        .map((item) => this.buildCrosswordUniqueKey(item))
        .filter((key): key is string => Boolean(key)),
    );

    const seenKeys = new Set(existingKeys);
    const crosswordsToInsert: any[] = [];
    let skippedExisting = 0;

    for (const crossword of crosswords) {
      const key = this.buildCrosswordUniqueKey(crossword, pack);
      if (key && seenKeys.has(key)) {
        skippedExisting++;
        continue;
      }

      if (key) {
        seenKeys.add(key);
      }
      crosswordsToInsert.push(crossword);
    }

    return { crosswordsToInsert, skippedExisting };
  }

  private buildCrosswordUniqueKey(
    crossword: Partial<Crossword> & { pack?: string },
    fallbackPack?: string,
  ): string | null {
    const pack = (crossword.pack ?? fallbackPack ?? "general").toLowerCase();

    if (crossword.date) {
      const dateValue = crossword.date instanceof Date
        ? crossword.date.toISOString().slice(0, 10)
        : `${crossword.date}`.slice(0, 10);
      return `${pack}::date::${dateValue}`;
    }

    if (crossword.title) {
      return `${pack}::title::${crossword.title.trim().toLowerCase()}`;
    }

    return null;
  }

  private async saveCrosswordsInBatches(
    repository: Repository<Crossword>,
    crosswords: any[],
    batchSize: number,
  ): Promise<void> {
    if (crosswords.length === 0) {
      return;
    }

    const effectiveBatchSize = Math.max(1, batchSize);
    for (let i = 0; i < crosswords.length; i += effectiveBatchSize) {
      const batch = crosswords.slice(i, i + effectiveBatchSize);
      const entities = repository.create(batch);
      await repository.save(entities);
    }
  }
}
