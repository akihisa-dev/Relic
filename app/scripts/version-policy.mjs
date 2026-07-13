import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const commitTypes = new Set([
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
]);

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const subjectPattern = /^([a-z]+)(!)?: ((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)) (.+)$/u;

export function parseVersion(value) {
  const match = versionPattern.exec(value);
  if (!match) {
    throw new Error(`Invalid version: ${value}`);
  }

  return match.slice(1).map(Number);
}

export function nextVersion(current, type, { major = false } = {}) {
  if (!commitTypes.has(type)) {
    throw new Error(`Unsupported commit type: ${type}`);
  }

  const [majorNumber, minorNumber, patchNumber] = parseVersion(current);
  if (major) {
    return `${majorNumber + 1}.0.0`;
  }
  if (type === "feat") {
    return `${majorNumber}.${minorNumber + 1}.0`;
  }
  return `${majorNumber}.${minorNumber}.${patchNumber + 1}`;
}

export function parseCommitSubject(subject) {
  const match = subjectPattern.exec(subject);
  if (!match || !commitTypes.has(match[1])) {
    throw new Error(`Invalid commit subject: ${subject}`);
  }

  return {
    type: match[1],
    breaking: Boolean(match[2]),
    version: match[3],
    description: match[4],
  };
}

export function validateVersionChange({ previous, current, message }) {
  const subject = message.split(/\r?\n/u, 1)[0];
  const parsed = parseCommitSubject(subject);
  const hasBreakingChange = parsed.breaking || /^BREAKING CHANGE:/mu.test(message);
  const hasMajorApproval = /^Version-Impact: major\s*$/imu.test(message);

  if (hasBreakingChange && !hasMajorApproval) {
    throw new Error("Breaking changes require an explicit Version-Impact: major trailer.");
  }

  const expected = nextVersion(previous, parsed.type, { major: hasMajorApproval });
  if (current !== expected) {
    throw new Error(`Expected package version ${expected}, received ${current}.`);
  }
  if (parsed.version !== current) {
    throw new Error(`Commit subject version ${parsed.version} does not match package version ${current}.`);
  }

  return { expected, type: parsed.type, major: hasMajorApproval };
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function packageVersionAt(revision) {
  const content = git(["show", `${revision}:app/package.json`]);
  return JSON.parse(content).version;
}

function checkRange(base, head) {
  const output = git(["rev-list", "--reverse", "--no-merges", `${base}..${head}`]);
  const commits = output ? output.split("\n") : [];

  for (const commit of commits) {
    const previous = packageVersionAt(`${commit}^`);
    const current = packageVersionAt(commit);
    const message = git(["show", "-s", "--format=%B", commit]);
    try {
      validateVersionChange({ previous, current, message });
    } catch (error) {
      throw new Error(`${commit.slice(0, 12)}: ${error.message}`);
    }
  }

  return commits.length;
}

function printUsage() {
  console.error("Usage:");
  console.error("  node scripts/version-policy.mjs next <current> <type> [--major]");
  console.error("  node scripts/version-policy.mjs check <previous> <current> <type> [--major]");
  console.error("  node scripts/version-policy.mjs check-range <base> <head>");
}

function main(args) {
  const [command, ...rawValues] = args;
  const values = rawValues[0] === "--" ? rawValues.slice(1) : rawValues;

  if (command === "next") {
    const [current, type] = values;
    if (!current || !type) {
      printUsage();
      return 1;
    }
    console.log(nextVersion(current, type, { major: values.includes("--major") }));
    return 0;
  }

  if (command === "check") {
    const [previous, current, type] = values;
    if (!previous || !current || !type) {
      printUsage();
      return 1;
    }
    const expected = nextVersion(previous, type, { major: values.includes("--major") });
    if (current !== expected) {
      throw new Error(`Expected version ${expected}, received ${current}.`);
    }
    console.log(`Version policy OK: ${previous} -> ${current}`);
    return 0;
  }

  if (command === "check-range") {
    const [base, head] = values;
    if (!base || !head) {
      printUsage();
      return 1;
    }
    const count = checkRange(base, head);
    console.log(`Version policy OK: ${count} commit(s) checked.`);
    return 0;
  }

  printUsage();
  return 1;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
