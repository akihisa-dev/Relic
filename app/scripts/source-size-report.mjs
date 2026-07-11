import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const includedExtensions = new Set([".css", ".mjs", ".ts", ".tsx"]);
const excludedDirectories = new Set([".vite", "coverage", "dist", "node_modules", "out"]);

export function classifySourceFile(filePath) {
  if (filePath.endsWith(".css")) return { category: "css", warningLines: 1000 };
  if (/\.(?:test|spec)\.[^.]+$/.test(filePath)) return { category: "test", warningLines: 1200 };
  return { category: "implementation", warningLines: 700 };
}

export function countSourceLines(content) {
  if (content.length === 0) return 0;
  const lines = content.split(/\r?\n/).length;
  return content.endsWith("\n") ? lines - 1 : lines;
}

async function walkSourceFiles(directory, rootDirectory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkSourceFiles(absolutePath, rootDirectory));
      continue;
    }
    if (!entry.isFile() || !includedExtensions.has(path.extname(entry.name))) continue;

    const relativePath = path.relative(rootDirectory, absolutePath).split(path.sep).join("/");
    const content = await readFile(absolutePath, "utf8");
    const classification = classifySourceFile(relativePath);
    const lines = countSourceLines(content);
    files.push({
      ...classification,
      lines,
      path: relativePath,
      warning: lines > classification.warningLines,
    });
  }

  return files;
}

export async function collectSourceSizeEntries(rootDirectory) {
  const entries = [];
  for (const sourceDirectory of ["src", "scripts"]) {
    const directory = path.join(rootDirectory, sourceDirectory);
    try {
      entries.push(...await walkSourceFiles(directory, rootDirectory));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return entries.sort((left, right) => right.lines - left.lines || left.path.localeCompare(right.path, "en"));
}

export function renderSourceSizeReport(entries) {
  const rows = entries.map((entry) => {
    const warning = entry.warning ? "WARN" : "    ";
    return `${warning} ${String(entry.lines).padStart(5)}  ${entry.category.padEnd(14)}  ${entry.path}`;
  });
  const warningCount = entries.filter((entry) => entry.warning).length;
  return [
    "状態  行数   分類            ファイル",
    ...rows,
    "",
    `${entries.length}ファイル、警告${warningCount}件（警告のみ。終了コードには影響しません）`,
  ].join("\n");
}

async function main() {
  const rootDirectory = process.cwd();
  const entries = await collectSourceSizeEntries(rootDirectory);
  console.log(renderSourceSizeReport(entries));
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
