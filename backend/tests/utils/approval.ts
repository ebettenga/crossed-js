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
  const serialized = JSON.stringify(received, null, 2);

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
      diffOutput = diffValues(parsedExisting, received, {
        expand: false,
      }) ?? "";
    } catch {
      diffOutput = diffValues(existing, serialized, { expand: false }) ?? "";
    }
  } else {
    diffOutput = serialized;
  }

  if (diffOutput) {
    console.log("\n--- Snapshot Diff ---");
    console.log(diffOutput);
    console.log("---------------------\n");
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
