import fs from "fs";
import os from "os";
import path from "path";
import { DataSource } from "typeorm";
import { CrosswordService } from "../../src/services/CrosswordService";
import { Crossword } from "../../src/entities/Crossword";
import { NotFoundError } from "../../src/errors/api";

jest.mock("../../src/scripts/findConfigDir", () => ({
  findDir: jest.fn(),
}));

import { findDir } from "../../src/scripts/findConfigDir";

const findDirMock = findDir as jest.MockedFunction<typeof findDir>;

jest.setTimeout(60000);

const TEST_DB =
  process.env.CROSSWORD_SERVICE_TEST_DB ||
  process.env.ROOM_SERVICE_TEST_DB ||
  process.env.POSTGRES_DB ||
  "crossed_test";

if (!/_test$/i.test(TEST_DB)) {
  throw new Error(
    `CrosswordService tests need a dedicated test database (received "${TEST_DB}").`,
  );
}

const TEST_SCHEMA =
  process.env.CROSSWORD_SERVICE_TEST_SCHEMA ||
  process.env.ROOM_SERVICE_TEST_SCHEMA ||
  "crossword_service_test";

const TEST_HOST =
  process.env.CROSSWORD_SERVICE_TEST_DB_HOST ||
  process.env.ROOM_SERVICE_TEST_DB_HOST ||
  process.env.PGHOST ||
  "127.0.0.1";
const TEST_PORT = parseInt(
  process.env.CROSSWORD_SERVICE_TEST_DB_PORT ||
    process.env.ROOM_SERVICE_TEST_DB_PORT ||
    process.env.PGPORT ||
    "5432",
  10,
);
const TEST_USER =
  process.env.CROSSWORD_SERVICE_TEST_DB_USER ||
  process.env.ROOM_SERVICE_TEST_DB_USER ||
  process.env.PGUSER ||
  "postgres";
const TEST_PASSWORD =
  process.env.CROSSWORD_SERVICE_TEST_DB_PASSWORD ||
  process.env.ROOM_SERVICE_TEST_DB_PASSWORD ||
  process.env.PGPASSWORD ||
  "postgres";

const baseConnectionOptions = {
  type: "postgres" as const,
  host: TEST_HOST,
  port: TEST_PORT,
  username: TEST_USER,
  password: TEST_PASSWORD,
  database: TEST_DB,
};

const qualified = (table: string) =>
  `"${TEST_SCHEMA}"."${table}"`;

let dataSource: DataSource;
let service: CrosswordService;

const ensureSchema = async () => {
  const admin = new DataSource({
    ...baseConnectionOptions,
    synchronize: false,
    entities: [],
  });
  await admin.initialize();
  await admin.query(`CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`);
  await admin.destroy();
};

const initialiseDataSource = async () => {
  dataSource = new DataSource({
    ...baseConnectionOptions,
    schema: TEST_SCHEMA,
    synchronize: true,
    entities: [Crossword],
  });
  await dataSource.initialize();
  service = new CrosswordService(dataSource);
};

const clearCrosswords = async () => {
  await dataSource.query(
    `TRUNCATE TABLE ${qualified("crossword")} RESTART IDENTITY CASCADE`,
  );
};

const createCrossword = async (
  overrides: Partial<Crossword> = {},
): Promise<Crossword> => {
  const repository = dataSource.getRepository(Crossword);
  const crossword = repository.create({
    clues: { across: [], down: [] },
    answers: { across: [], down: [] },
    author: "Test Author",
    created_by: "Tester",
    creator_link: "https://example.com",
    circles: [],
    date: new Date("2025-01-01"),
    dow: "Monday",
    grid: Array(16).fill("A"),
    gridnums: [],
    shadecircles: false,
    col_size: 4,
    row_size: 4,
    jnote: "Test jnote",
    notepad: "Test notepad",
    title: "Test Crossword",
    ...overrides,
  });
  return repository.save(crossword);
};

beforeAll(async () => {
  try {
    await ensureSchema();
    await initialiseDataSource();
  } catch (error) {
    console.error(
      "Failed to initialise CrosswordService integration environment. Verify Postgres settings.",
    );
    throw error;
  }
});

beforeEach(async () => {
  jest.clearAllMocks();
  await clearCrosswords();
});

afterAll(async () => {
  if (dataSource?.isInitialized) {
    await dataSource.destroy();
  }
});

describe("CrosswordService integration", () => {
  it("filters crosswords by provided parameters", async () => {
    const repository = dataSource.getRepository(Crossword);
    await repository.save([
      repository.create({
        title: "Easy Monday",
        dow: "Monday",
        col_size: 4,
        row_size: 4,
        grid: Array(16).fill("M"),
        clues: { across: [], down: [] },
        answers: { across: [], down: [] },
        circles: [],
        date: new Date("2024-12-30"),
        shadecircles: false,
        jnote: "Test jnote",
        notepad: "Test notepad",
        author: "Test Author",
        created_by: "Tester",
        creator_link: "https://example.com",
      }),
      repository.create({
        title: "Second Monday",
        dow: "Monday",
        col_size: 4,
        row_size: 4,
        grid: Array(16).fill("N"),
        clues: { across: [], down: [] },
        answers: { across: [], down: [] },
        circles: [],
        date: new Date("2024-12-31"),
        shadecircles: false,
        jnote: "Test jnote",
        notepad: "Test notepad",
        author: "Test Author",
        created_by: "Tester",
        creator_link: "https://example.com",
      }),
      repository.create({
        title: "Different Size",
        dow: "Tuesday",
        col_size: 5,
        row_size: 5,
        grid: Array(25).fill("T"),
        clues: { across: [], down: [] },
        answers: { across: [], down: [] },
        circles: [],
        date: new Date("2025-01-02"),
        shadecircles: false,
        jnote: "Test jnote",
        notepad: "Test notepad",
        author: "Test Author",
        created_by: "Tester",
        creator_link: "https://example.com",
      }),
    ]);

    const result = await service.getCrosswords(1, 10, "Monday", 4, 4);

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.title).sort()).toEqual([
      "Easy Monday",
      "Second Monday",
    ]);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });

  it("loads crosswords from filesystem and skips outdated files", async () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "crossword-service-load-"),
    );
    const nestedDir = path.join(tempDir, "nested");
    fs.mkdirSync(nestedDir);

    const basePuzzle = {
      title: "Filesystem Puzzle",
      author: "FS Author",
      clues: { across: [], down: [] },
      answers: { across: [], down: [] },
      circles: [],
      size: { cols: 4, rows: 4 },
      grid: Array(16).fill("A"),
      gridnums: [],
      date: "2025-01-01",
      dow: "Monday",
      shadecircles: "yes",
    };

    fs.writeFileSync(
      path.join(tempDir, "puzzle.json"),
      JSON.stringify(basePuzzle),
    );
    fs.writeFileSync(
      path.join(nestedDir, "puzzle-two.json"),
      JSON.stringify({
        ...basePuzzle,
        title: "Filesystem Puzzle Two",
        date: "2025-01-02",
        grid: Array(16).fill("B"),
      }),
    );
    fs.writeFileSync(
      path.join(tempDir, "old.json"),
      JSON.stringify({
        ...basePuzzle,
        title: "Old Puzzle",
        date: "1999-12-31",
      }),
    );

    findDirMock.mockReturnValue(tempDir);

    try {
      await service.loadCrosswords();

      const repository = dataSource.getRepository(Crossword);
      const loaded = await repository.find();
      expect(loaded).toHaveLength(2);
      expect(loaded.map((c) => c.title).sort()).toEqual([
        "Filesystem Puzzle",
        "Filesystem Puzzle Two",
      ]);
      expect(loaded.every((c) => c.col_size === 4 && c.row_size === 4)).toBe(
        true,
      );
      expect(loaded.every((c) => c.shadecircles === true)).toBe(true);
    } finally {
      findDirMock.mockReset();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("creates a masked letter template for an existing crossword", async () => {
    const crossword = await createCrossword({
      grid: ["A", "b", "-", "c"],
      col_size: 2,
      row_size: 2,
    });

    const template = await service.createFoundLettersTemplate(crossword.id);

    expect(template).toEqual(["*", "*", "-", "*"]);
  });

  it("throws when creating a template for a missing crossword", async () => {
    await expect(service.createFoundLettersTemplate(99999)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("returns a crossword that matches the requested difficulty", async () => {
    await createCrossword({
      title: "Monday Puzzle",
      dow: "Monday",
      date: new Date("2024-01-01"),
    });
    await createCrossword({
      title: "Tuesday Puzzle",
      dow: "Tuesday",
      date: new Date("2024-01-02"),
    });
    await createCrossword({
      title: "Wednesday Puzzle",
      dow: "Wednesday",
      grid: Array(16).fill("W"),
      date: new Date("2024-01-03"),
    });
    await createCrossword({
      title: "Thursday Puzzle",
      dow: "Thursday",
      grid: Array(16).fill("T"),
      date: new Date("2024-01-04"),
    });

    const easy = await service.getCrosswordByDifficulty("easy");
    expect(easy).not.toBeNull();
    expect(["Monday", "Tuesday"]).toContain(easy?.dow);

    const medium = await service.getCrosswordByDifficulty("medium");
    expect(medium).not.toBeNull();
    expect(["Wednesday", "Thursday"]).toContain(medium?.dow);

    const hard = await service.getCrosswordByDifficulty("hard");
    expect(hard).toBeNull();

    await expect(service.getCrosswordByDifficulty("impossible")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("validates guesses against crossword coordinates", async () => {
    const crossword = await createCrossword({
      grid: ["A", "B", "C", "D"],
      col_size: 2,
      row_size: 2,
    });

    expect(
      service.checkGuess(crossword, { x: 0, y: 1 }, "b"),
    ).toBe(true);
    expect(
      service.checkGuess(crossword, { x: 1, y: 0 }, "Z"),
    ).toBe(false);
    expect(() =>
      service.checkGuess(crossword, { x: 2, y: 0 }, "A"),
    ).toThrow(NotFoundError);
  });
});
