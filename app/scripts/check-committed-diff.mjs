import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const zeroCommit = /^0+$/u;

export function normalizeCommit(value) {
  const commit = value?.trim();
  return commit && !zeroCommit.test(commit) ? commit : null;
}

export function checkCommittedDiff(base, head, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const output = options.stdio ?? "inherit";
  const headCommit = normalizeCommit(head);
  if (!headCommit) throw new Error("A head commit is required.");

  const baseCommit = normalizeCommit(base) ?? fallbackBaseCommit(headCommit, cwd);
  execFileSync("git", ["diff", "--check", baseCommit, headCommit, "--"], {
    cwd,
    stdio: output
  });
  return { base: baseCommit, head: headCommit };
}

function fallbackBaseCommit(head, cwd) {
  try {
    return execFileSync("git", ["rev-parse", "--verify", `${head}^`], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return execFileSync("git", ["hash-object", "-t", "tree", "--stdin"], {
      cwd,
      encoding: "utf8",
      input: ""
    }).trim();
  }
}

function main() {
  const rawValues = process.argv.slice(2);
  const [base, head] = rawValues[0] === "--" ? rawValues.slice(1) : rawValues;
  const range = checkCommittedDiff(base, head);
  console.log(`Committed diff check passed: ${range.base}..${range.head}`);
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
