import { Crossword } from "../entities/Crossword.entity";
import { decodeHtmlEntities } from "./decodeHtmlEntities";

type IpuzClue = {
  number: number;
  clue: string;
};

type IpuzData = {
  title?: string;
  author?: string;
  copyright?: string;
  origin?: string;
  notes?: string;
  intro?: string;
  puzzle: Array<Array<number | string | { cell: string | number }>>;
  solution: Array<
    Array<
      | string
      | {
        value: string;
        cell: string | number;
      }
    >
  >;
  clues: {
    Across?: IpuzClue[];
    across?: IpuzClue[];
    Down?: IpuzClue[];
    down?: IpuzClue[];
  };
};

type TransformOptions = {
  date: Date;
  dow: string;
};

type CrosswordClues = {
  across: string[];
  down: string[];
};

type CrosswordAnswers = {
  across: string[];
  down: string[];
};

const getClueList = (clues?: IpuzClue[] | null): string[] => {
  if (!clues) {
    return [];
  }
  return clues.map((clue) =>
    `${clue.number}. ${decodeHtmlEntities(clue.clue)}`.trim()
  );
};

const toLetter = (value: string): string =>
  value === "#" ? "#" : value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

export const ipuzToCrossword = (
  ipuz: IpuzData,
  options: TransformOptions,
): Partial<Crossword> => {
  if (!Array.isArray(ipuz.solution) || ipuz.solution.length === 0) {
    throw new Error("IPUZ file is missing a solution grid");
  }

  const rows = ipuz.solution.length;
  const cols = ipuz.solution[0]?.length;

  if (!cols) {
    throw new Error("IPUZ solution grid is malformed");
  }

  const grid: string[] = [];
  const gridnums: string[] = [];
  const circles: number[] = [];

  const letterGrid: string[][] = new Array(rows)
    .fill(null)
    .map(() => new Array(cols).fill("#"));

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const entry = ipuz.solution[row][col];
      const value = typeof entry === "string"
        ? entry
        : entry && typeof entry.value === "string"
        ? entry.value
        : "#";

      const normalizedValue = toLetter(value);
      letterGrid[row][col] = normalizedValue;
      grid.push(normalizedValue === "#" ? "." : normalizedValue);

      const puzzleEntry = ipuz.puzzle?.[row]?.[col];
      const clueNumber = typeof puzzleEntry === "number"
        ? puzzleEntry
        : puzzleEntry && typeof (puzzleEntry as any).cell === "number"
        ? (puzzleEntry as any).cell
        : 0;

      gridnums.push(clueNumber.toString());
      circles.push(0);
    }
  }

  const acrossAnswers: string[] = [];
  const downAnswers: string[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const value = letterGrid[row][col];
      if (value === "#") {
        continue;
      }

      const isStartOfAcross = col === 0 || letterGrid[row][col - 1] === "#";
      if (isStartOfAcross) {
        let word = "";
        let pointer = col;
        while (pointer < cols && letterGrid[row][pointer] !== "#") {
          word += letterGrid[row][pointer];
          pointer += 1;
        }
        acrossAnswers.push(word);
      }

      const isStartOfDown = row === 0 || letterGrid[row - 1][col] === "#";
      if (isStartOfDown) {
        let word = "";
        let pointer = row;
        while (pointer < rows && letterGrid[pointer][col] !== "#") {
          word += letterGrid[pointer][col];
          pointer += 1;
        }
        downAnswers.push(word);
      }
    }
  }

  const acrossClues = getClueList(ipuz.clues?.Across ?? ipuz.clues?.across) ??
    [];
  const downClues = getClueList(ipuz.clues?.Down ?? ipuz.clues?.down) ?? [];

  if (
    acrossClues.length > 0 &&
    acrossClues.length !== acrossAnswers.length
  ) {
    throw new Error(
      `Across clue count (${acrossClues.length}) does not match answer count (${acrossAnswers.length})`,
    );
  }

  if (downClues.length > 0 && downClues.length !== downAnswers.length) {
    throw new Error(
      `Down clue count (${downClues.length}) does not match answer count (${downAnswers.length})`,
    );
  }

  const clues: CrosswordClues = {
    across: acrossClues,
    down: downClues,
  };

  const answers: CrosswordAnswers = {
    across: acrossAnswers,
    down: downAnswers,
  };

  return {
    title: decodeHtmlEntities(ipuz.title),
    author: decodeHtmlEntities(ipuz.author),
    created_by: decodeHtmlEntities(ipuz.origin),
    notepad: decodeHtmlEntities(ipuz.notes),
    jnote: decodeHtmlEntities(ipuz.intro),
    row_size: rows,
    col_size: cols,
    grid,
    gridnums,
    circles,
    shadecircles: false,
    clues,
    answers,
    date: options.date,
    dow: options.dow,
  };
};
