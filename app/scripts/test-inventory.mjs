import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testPattern = /\.(?:test|spec)\.(?:mjs|ts|tsx)$/u;

export function classifyTestFile(relativePath) {
  if (relativePath.endsWith(".test.tsx")) return "react-component";
  if (relativePath.startsWith("src/main/ipc/")) return "main-handler-contract";
  if (relativePath.startsWith("src/preload/")) return "preload-contract";
  if (/^src\/main\/(?:files|settings|workspace)\//u.test(relativePath)) return "filesystem-integration";
  if (relativePath.startsWith("scripts/") || relativePath.startsWith("build-tools/")) return "development-tooling";
  return "unit-model";
}

async function walk(directory, rootDirectory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    if (["coverage", "node_modules", "out", ".vite"].includes(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolutePath, rootDirectory));
    if (entry.isFile() && testPattern.test(entry.name)) {
      files.push(path.relative(rootDirectory, absolutePath).split(path.sep).join("/"));
    }
  }
  return files;
}

export async function collectTestInventory(rootDirectory) {
  const files = await walk(rootDirectory, rootDirectory);
  const counts = Object.fromEntries([
    "unit-model", "react-component", "main-handler-contract", "preload-contract",
    "filesystem-integration", "development-tooling", "electron-smoke", "os-package"
  ].map((category) => [category, 0]));
  for (const file of files) counts[classifyTestFile(file)] += 1;
  return { counts, files: files.sort(), total: files.length };
}

export function renderTestInventory(inventory) {
  return [
    "Test role inventory",
    ...Object.entries(inventory.counts).map(([category, count]) => `${category}: ${count}`),
    `total: ${inventory.total}`,
    "electron-smoke and os-package are workflow/manual verification roles, not Vitest files."
  ].join("\n");
}

async function main() {
  console.log(renderTestInventory(await collectTestInventory(process.cwd())));
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
