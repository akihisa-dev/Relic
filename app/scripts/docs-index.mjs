import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const indexPath = path.join(repoRoot, "docs", "INDEX.md");
const treeHeading = "## 全ファイル・フォルダ構成";
const treeIntro = "以下はGitで管理しているファイルとフォルダの一覧です。";

const mode = process.argv[2];

if (mode !== "--check" && mode !== "--write") {
  console.error("Usage: node scripts/docs-index.mjs --check|--write");
  process.exit(2);
}

function readTrackedFiles() {
  const output = execFileSync(
    "git",
    ["-C", repoRoot, "-c", "core.quotePath=false", "ls-files"],
    { encoding: "utf8" },
  );

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort(compareNames);
}

function compareNames(a, b) {
  return a.localeCompare(b, "en");
}

function buildTree(files) {
  const root = new Map();

  for (const file of files) {
    const parts = file.split("/");
    let children = root;

    parts.forEach((part, index) => {
      if (!children.has(part)) {
        children.set(part, { children: new Map(), isFile: false });
      }

      const node = children.get(part);
      if (index === parts.length - 1) {
        node.isFile = true;
      }
      children = node.children;
    });
  }

  return root;
}

function renderTree(files) {
  const root = buildTree(files);
  return renderChildren(root, 0).join("\n");
}

function renderChildren(children, depth) {
  const entries = [...children.entries()].sort(([a], [b]) => compareNames(a, b));
  const directories = entries.filter(([, node]) => !node.isFile);
  const files = entries.filter(([, node]) => node.isFile);
  const lines = [];
  const indent = "  ".repeat(depth);

  for (const [name, node] of directories) {
    lines.push(`${indent}- \`${name}/\``);
    lines.push(...renderChildren(node.children, depth + 1));
  }

  for (const [name] of files) {
    lines.push(`${indent}- \`${name}\``);
  }

  return lines;
}

function buildExpectedIndex(currentContent, files) {
  const start = currentContent.indexOf(treeHeading);
  if (start === -1) {
    throw new Error(`${indexPath} に "${treeHeading}" が見つかりません。`);
  }

  const prefix = currentContent.slice(0, start);
  return `${prefix}${treeHeading}\n\n${treeIntro}\n\n${renderTree(files)}\n`;
}

function readIndexedFiles(content) {
  const start = content.indexOf(treeHeading);
  if (start === -1) {
    return [];
  }

  const stack = [];
  const files = [];
  const lines = content.slice(start).split("\n");

  for (const line of lines) {
    const match = line.match(/^(\s*)- `([^`]+)`/);
    if (!match) {
      continue;
    }

    const indent = match[1].length;
    const name = match[2];
    const level = Math.floor(indent / 2);
    stack.length = level;
    stack[level] = name;

    if (!name.endsWith("/")) {
      files.push(stack.slice(0, level + 1).join(""));
    }
  }

  return files.sort(compareNames);
}

function diffFiles(expected, actual) {
  return {
    missing: expected.filter((file) => !actual.includes(file)),
    extra: actual.filter((file) => !expected.includes(file)),
  };
}

const trackedFiles = readTrackedFiles();
const currentContent = readFileSync(indexPath, "utf8");
const expectedContent = buildExpectedIndex(currentContent, trackedFiles);

if (mode === "--write") {
  if (currentContent === expectedContent) {
    console.log("docs/INDEX.md is already up to date.");
  } else {
    writeFileSync(indexPath, expectedContent);
    console.log("docs/INDEX.md updated.");
  }
  process.exit(0);
}

if (currentContent === expectedContent) {
  console.log("docs/INDEX.md is up to date.");
  process.exit(0);
}

const indexedFiles = readIndexedFiles(currentContent);
const { missing, extra } = diffFiles(trackedFiles, indexedFiles);

console.error("docs/INDEX.md is out of sync with git ls-files.");
console.error("Run: cd app && pnpm docs:index:update");
console.error(`tracked=${trackedFiles.length} indexed=${indexedFiles.length}`);

if (missing.length > 0) {
  console.error("\nMissing from docs/INDEX.md:");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
}

if (extra.length > 0) {
  console.error("\nExtra in docs/INDEX.md:");
  for (const file of extra) {
    console.error(`- ${file}`);
  }
}

process.exit(1);
