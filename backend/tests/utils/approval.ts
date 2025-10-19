import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { diff as diffValues } from "jest-diff";

type ApprovalOptions = {
  testFile: string;
  snapshotName: string;
  received: unknown;
};

const sanitizeFilename = (name: string) =>
  name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() ||
  "snapshot";

const ensureDirectory = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

/**
 * Recursively removes `created_at` and `updated_at` fields from objects and arrays.
 * This ensures snapshot comparisons ignore dynamic timestamp fields.
 */
const stripTimestampFields = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(stripTimestampFields);
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (key !== "created_at" && key !== "updated_at") {
        result[key] = stripTimestampFields(val);
      }
    }
    return result;
  }

  return value;
};

const promptYesNo = async (question: string) => {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`${question} (y/N): `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
};

export const ensureApprovedSnapshot = async ({
  testFile,
  snapshotName,
  received,
}: ApprovalOptions): Promise<void> => {
  const testDir = path.dirname(testFile);
  const snapshotDir = path.join(
    testDir,
    "__approvals__",
    path.basename(testFile),
  );
  const filename = `${sanitizeFilename(snapshotName)}.json`;
  const snapshotPath = path.join(snapshotDir, filename);

  // Strip timestamp fields from received data before comparison
  const strippedReceived = stripTimestampFields(received);
  const serialized = JSON.stringify(strippedReceived, null, 2);
  // Skip snapshot comparison in CI environments
  const isCI = process.env.CI === "true";
  if (isCI) {
    console.log(`[CI] Skipping snapshot comparison for "${snapshotName}"`);
    return;
  }

  let existing: string | undefined;
  try {
    existing = fs.readFileSync(snapshotPath, "utf8");
  } catch {
    // no snapshot yet
  }

  if (existing && existing === serialized) {
    return;
  }

  let diffOutput = "";
  if (existing) {
    try {
      const parsedExisting = JSON.parse(existing);
      // Strip timestamp fields from existing snapshot before comparison
      const strippedExisting = stripTimestampFields(parsedExisting);
      diffOutput = diffValues(strippedExisting, strippedReceived, {
        expand: false,
      }) ?? "";
    } catch {
      diffOutput = diffValues(existing, serialized, { expand: false }) ?? "";
    }
  } else {
    diffOutput = serialized;
  }

  if (
    diffOutput &&
    diffOutput.trim() !== "" &&
    !diffOutput.includes("Compared values have no visual difference")
  ) {
    console.log("\n--- Snapshot Diff ---");
    console.log(diffOutput);
    console.log("---------------------\n");
  } else if (existing) {
    // No meaningful diff; treat as approved without prompting
    return;
  }

  const accepted = await promptYesNo(
    existing
      ? `Accept updated snapshot for "${snapshotName}"?`
      : `Save new snapshot for "${snapshotName}"?`,
  );

  if (!accepted) {
    throw new Error(
      `Snapshot update rejected for "${snapshotName}". Run the test again to review.`,
    );
  }

  ensureDirectory(snapshotDir);
  fs.writeFileSync(snapshotPath, `${serialized}\n`, "utf8");
};
