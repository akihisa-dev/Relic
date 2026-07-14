import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const includedExtensions = new Set([".css", ".mjs", ".ts", ".tsx"]);
const excludedDirectories = new Set([".vite", "coverage", "dist", "node_modules", "out"]);
const retainedLargeSourceReasons = new Map([
  ["src/renderer/styles/chronicle.css", "年表画面の構成要素とレスポンシブ上書きを一続きで管理する単一機能CSS"],
  ["src/renderer/styles/settings.css", "設定画面の各セクションを共通レイアウトと状態上書きとともに管理する単一機能CSS"]
]);

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
      retainedReason: retainedLargeSourceReasons.get(relativePath),
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

export function createSourceSizeBaseline(entries) {
  return {
    entries: Object.fromEntries(entries.map((entry) => [entry.path, entry.lines])),
    version: 1
  };
}

export function compareSourceSizeEntries(entries, baseline) {
  const baselineEntries = baseline?.version === 1 && baseline.entries ? baseline.entries : {};
  return entries.map((entry) => {
    const baselineLines = baselineEntries[entry.path];
    const delta = typeof baselineLines === "number" ? entry.lines - baselineLines : null;
    const growthPercent = typeof baselineLines === "number" && baselineLines > 0
      ? (delta / baselineLines) * 100
      : null;
    const minimumGrowth = entry.category === "implementation" ? 50 : 100;
    return {
      ...entry,
      baselineLines: typeof baselineLines === "number" ? baselineLines : null,
      delta,
      growthPercent,
      growthWarning: delta !== null && delta >= minimumGrowth && growthPercent >= 20
    };
  });
}

export function renderSourceSizeReport(entries) {
  const rows = entries.map((entry) => {
    const warning = entry.growthWarning ? "GROW" : entry.warning ? "WARN" : "    ";
    const retainedReason = entry.retainedReason ? ` （継続理由: ${entry.retainedReason}）` : "";
    const delta = entry.delta === null || entry.delta === undefined
      ? "   new"
      : `${entry.delta >= 0 ? "+" : ""}${entry.delta}`.padStart(6);
    return `${warning} ${String(entry.lines).padStart(5)} ${delta}  ${entry.category.padEnd(14)}  ${entry.path}${retainedReason}`;
  });
  const warningCount = entries.filter((entry) => entry.warning).length;
  const growthWarningCount = entries.filter((entry) => entry.growthWarning).length;
  return [
    "状態  行数   増減    分類            ファイル",
    ...rows,
    "",
    `${entries.length}ファイル、絶対行数警告${warningCount}件、急増警告${growthWarningCount}件（警告のみ。終了コードには影響しません）`,
  ].join("\n");
}

async function main() {
  const rootDirectory = process.cwd();
  const entries = await collectSourceSizeEntries(rootDirectory);
  const writeBaselineIndex = process.argv.indexOf("--write-baseline");
  if (writeBaselineIndex >= 0) {
    const outputPath = process.argv[writeBaselineIndex + 1];
    if (!outputPath) throw new Error("--write-baseline requires an output path.");
    await writeFile(path.resolve(rootDirectory, outputPath), `${JSON.stringify(createSourceSizeBaseline(entries), null, 2)}\n`);
    console.log(`Source size baseline updated: ${outputPath}`);
    return;
  }

  let baseline = null;
  try {
    baseline = JSON.parse(await readFile(path.join(rootDirectory, "scripts/baselines/source-lines.json"), "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  console.log(renderSourceSizeReport(compareSourceSizeEntries(entries, baseline)));
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
