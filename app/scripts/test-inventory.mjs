import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const testPattern = /\.(?:test|spec)\.(?:mjs|ts|tsx)$/u;
const oversizedTestLines = 700;
const roles = [
  "unit-model",
  "react-component",
  "main-handler-contract",
  "preload-contract",
  "filesystem-integration",
  "development-tooling"
];

export function classifyTestFile(relativePath) {
  if (relativePath.startsWith("src/main/ipc/")) return "main-handler-contract";
  if (relativePath.startsWith("src/preload/")) return "preload-contract";
  if (/^src\/main\/(?:files|settings|workspace)\//u.test(relativePath)) return "filesystem-integration";
  if (relativePath.startsWith("scripts/") || relativePath.startsWith("build-tools/")) return "development-tooling";
  if (relativePath.startsWith("src/renderer/") && relativePath.endsWith(".test.tsx")) return "react-component";
  return "unit-model";
}

export function classifyTestProject(relativePath) {
  return relativePath.startsWith("src/renderer/") ? "renderer" : "node";
}

export function inspectTestSource(content) {
  const lines = content.length === 0
    ? 0
    : content.split(/\r?\n/u).length - (content.endsWith("\n") ? 1 : 0);
  const sourceFile = ts.createSourceFile(
    "inventory.test.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  let disabledDeclarations = 0;
  let focusedDeclarations = 0;
  let testDeclarations = 0;

  function readCallChain(expression) {
    if (ts.isIdentifier(expression)) return { modifiers: [], root: expression.text };
    if (ts.isPropertyAccessExpression(expression)) {
      const chain = readCallChain(expression.expression);
      return chain && { modifiers: [...chain.modifiers, expression.name.text], root: chain.root };
    }
    if (ts.isCallExpression(expression)) return readCallChain(expression.expression);
    return null;
  }

  function visit(node) {
    if (ts.isCallExpression(node)
      && !(ts.isCallExpression(node.parent) && node.parent.expression === node)) {
      const chain = readCallChain(node.expression);
      if (chain && ["describe", "it", "test"].includes(chain.root)) {
        if (chain.modifiers.some((modifier) => ["skip", "skipIf", "todo"].includes(modifier))) {
          disabledDeclarations += 1;
        }
        if (chain.modifiers.includes("only")) focusedDeclarations += 1;
        if (chain.root === "it" || chain.root === "test") testDeclarations += 1;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  return { disabledDeclarations, focusedDeclarations, lines, testDeclarations };
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
  const files = (await walk(rootDirectory, rootDirectory)).sort();
  const entries = await Promise.all(files.map(async (relativePath) => {
    const source = await readFile(path.join(rootDirectory, relativePath), "utf8");
    return {
      path: relativePath,
      project: classifyTestProject(relativePath),
      role: classifyTestFile(relativePath),
      ...inspectTestSource(source)
    };
  }));
  const counts = Object.fromEntries(roles.map((role) => [role, 0]));
  const projects = { node: 0, renderer: 0 };
  for (const entry of entries) {
    counts[entry.role] += 1;
    projects[entry.project] += 1;
  }
  const totals = entries.reduce((result, entry) => ({
    disabledDeclarations: result.disabledDeclarations + entry.disabledDeclarations,
    focusedDeclarations: result.focusedDeclarations + entry.focusedDeclarations,
    lines: result.lines + entry.lines,
    testDeclarations: result.testDeclarations + entry.testDeclarations
  }), { disabledDeclarations: 0, focusedDeclarations: 0, lines: 0, testDeclarations: 0 });
  const attention = entries
    .filter((entry) => entry.lines >= oversizedTestLines
      || entry.disabledDeclarations > 0
      || entry.focusedDeclarations > 0)
    .sort((left, right) => right.lines - left.lines || left.path.localeCompare(right.path, "en"));
  return { attention, counts, entries, files, projects, total: files.length, totals };
}

export function renderTestInventory(inventory) {
  return [
    "Test role inventory",
    ...Object.entries(inventory.counts).map(([category, count]) => `${category}: ${count}`),
    "",
    "Vitest projects",
    ...Object.entries(inventory.projects).map(([project, count]) => `${project}: ${count}`),
    "",
    "Scale and directives",
    `total: ${inventory.total}`,
    `test-declarations: ${inventory.totals.testDeclarations}`,
    `lines: ${inventory.totals.lines}`,
    `disabled: ${inventory.totals.disabledDeclarations}`,
    `focused: ${inventory.totals.focusedDeclarations}`,
    "",
    `Maintenance attention (${oversizedTestLines}+ lines or disabled/focused directives)`,
    ...(inventory.attention.length === 0
      ? ["none"]
      : inventory.attention.map((entry) => [
        `${entry.lines} lines`,
        `${entry.testDeclarations} declarations`,
        entry.disabledDeclarations > 0 ? `${entry.disabledDeclarations} disabled` : null,
        entry.focusedDeclarations > 0 ? `${entry.focusedDeclarations} focused` : null,
        entry.path
      ].filter(Boolean).join(" | "))),
    "",
    "Electron smoke and macOS package checks are dedicated process/workflow roles, not Vitest files."
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
