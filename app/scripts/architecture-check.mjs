import { builtinModules } from "node:module";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const sourceExtensions = [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx"];
const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`)
]);
const allowedLocalLayers = {
  main: new Set(["main", "shared"]),
  preload: new Set(["preload", "shared"]),
  renderer: new Set(["renderer", "shared"]),
  shared: new Set(["shared"])
};

export async function analyzeArchitecture(rootDirectory) {
  const sourceRoot = path.join(rootDirectory, "src");
  const files = await collectSourceFiles(sourceRoot);
  const fileSet = new Set(files);
  const graph = new Map(files.map((filePath) => [filePath, new Set()]));
  const violations = [];

  for (const filePath of files) {
    const sourceLayer = sourceLayerForPath(sourceRoot, filePath);
    if (!sourceLayer) continue;

    const content = await readFile(filePath, "utf8");
    for (const specifier of collectModuleSpecifiers(content, filePath)) {
      if (isNodeBuiltin(specifier) && (sourceLayer === "renderer" || sourceLayer === "shared")) {
        violations.push(formatViolation(sourceRoot, filePath, `Node.js API「${specifier}」を${sourceLayer}から参照しています`));
        continue;
      }
      if ((specifier === "electron" || specifier.startsWith("electron/"))
        && (sourceLayer === "renderer" || sourceLayer === "shared")) {
        violations.push(formatViolation(sourceRoot, filePath, `Electron API「${specifier}」を${sourceLayer}から参照しています`));
        continue;
      }
      if (!specifier.startsWith(".")) continue;

      const targetPath = resolveLocalModule(filePath, specifier, fileSet);
      if (!targetPath) continue;
      graph.get(filePath)?.add(targetPath);

      const targetLayer = sourceLayerForPath(sourceRoot, targetPath);
      if (!targetLayer || allowedLocalLayers[sourceLayer].has(targetLayer)) continue;
      violations.push(formatViolation(
        sourceRoot,
        filePath,
        `${sourceLayer}から${targetLayer}への依存「${relativeSourcePath(sourceRoot, targetPath)}」は禁止されています`
      ));
    }
  }

  return {
    cycles: findCycles(graph).map((cycle) => cycle.map((filePath) => relativeSourcePath(sourceRoot, filePath))),
    violations: violations.sort((left, right) => left.localeCompare(right, "en"))
  };
}

export function collectModuleSpecifiers(content, fileName = "source.ts") {
  const sourceFile = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    false,
    scriptKindForFile(fileName)
  );
  const specifiers = [];

  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteralLike(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression
      && ts.isStringLiteralLike(node.moduleReference.expression)) {
      specifiers.push(node.moduleReference.expression.text);
    } else if (ts.isCallExpression(node)
      && node.arguments.length === 1
      && ts.isStringLiteralLike(node.arguments[0])
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

export function formatArchitectureReport(result) {
  if (result.violations.length === 0 && result.cycles.length === 0) {
    return "Architecture check passed: process boundaries are intact and no dependency cycles were found.";
  }

  const lines = ["Architecture check failed."];
  if (result.violations.length > 0) {
    lines.push("", "Boundary violations:", ...result.violations.map((violation) => `- ${violation}`));
  }
  if (result.cycles.length > 0) {
    lines.push("", "Dependency cycles:", ...result.cycles.map((cycle) => `- ${cycle.join(" -> ")}`));
  }
  return lines.join("\n");
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "test") continue;
      files.push(...await collectSourceFiles(filePath));
      continue;
    }
    if (!entry.isFile() || !sourceExtensions.includes(path.extname(entry.name))) continue;
    if (/\.(?:test|spec)\.[^.]+$/.test(entry.name) || entry.name.endsWith(".d.ts")) continue;
    files.push(path.resolve(filePath));
  }
  return files;
}

function sourceLayerForPath(sourceRoot, filePath) {
  const [layer] = relativeSourcePath(sourceRoot, filePath).split("/");
  return Object.hasOwn(allowedLocalLayers, layer) ? layer : null;
}

function relativeSourcePath(sourceRoot, filePath) {
  return path.relative(sourceRoot, filePath).split(path.sep).join("/");
}

function formatViolation(sourceRoot, filePath, message) {
  return `${relativeSourcePath(sourceRoot, filePath)}: ${message}`;
}

function isNodeBuiltin(specifier) {
  return nodeBuiltins.has(specifier) || nodeBuiltins.has(specifier.replace(/^node:/, ""));
}

function resolveLocalModule(importerPath, specifier, fileSet) {
  const basePath = path.resolve(path.dirname(importerPath), specifier);
  const candidates = path.extname(basePath)
    ? [basePath]
    : [
        ...sourceExtensions.map((extension) => `${basePath}${extension}`),
        ...sourceExtensions.map((extension) => path.join(basePath, `index${extension}`))
      ];
  return candidates.map((candidate) => path.resolve(candidate)).find((candidate) => fileSet.has(candidate)) ?? null;
}

function findCycles(graph) {
  const indexByFile = new Map();
  const lowLinkByFile = new Map();
  const stack = [];
  const onStack = new Set();
  const cycles = [];
  let nextIndex = 0;

  function connect(filePath) {
    indexByFile.set(filePath, nextIndex);
    lowLinkByFile.set(filePath, nextIndex);
    nextIndex += 1;
    stack.push(filePath);
    onStack.add(filePath);

    for (const targetPath of graph.get(filePath) ?? []) {
      if (!indexByFile.has(targetPath)) {
        connect(targetPath);
        lowLinkByFile.set(filePath, Math.min(lowLinkByFile.get(filePath), lowLinkByFile.get(targetPath)));
      } else if (onStack.has(targetPath)) {
        lowLinkByFile.set(filePath, Math.min(lowLinkByFile.get(filePath), indexByFile.get(targetPath)));
      }
    }

    if (lowLinkByFile.get(filePath) !== indexByFile.get(filePath)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== filePath);

    const isSelfCycle = component.length === 1 && graph.get(component[0])?.has(component[0]);
    if (component.length > 1 || isSelfCycle) {
      cycles.push(component.sort((left, right) => left.localeCompare(right, "en")));
    }
  }

  for (const filePath of [...graph.keys()].sort((left, right) => left.localeCompare(right, "en"))) {
    if (!indexByFile.has(filePath)) connect(filePath);
  }
  return cycles.sort((left, right) => left[0].localeCompare(right[0], "en"));
}

function scriptKindForFile(fileName) {
  if (fileName.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (fileName.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (fileName.endsWith(".js") || fileName.endsWith(".mjs")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

async function main() {
  const result = await analyzeArchitecture(process.cwd());
  console.log(formatArchitectureReport(result));
  if (result.violations.length > 0 || result.cycles.length > 0) process.exitCode = 1;
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
