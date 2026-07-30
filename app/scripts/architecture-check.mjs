import { builtinModules } from "node:module";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const sourceExtensions = [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx"];
const localModuleExtensions = [...sourceExtensions, ".css", ".json"];
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
  const localFileSet = new Set(await collectLocalFiles(sourceRoot));
  const graph = new Map(files.map((filePath) => [filePath, new Set()]));
  const violations = await validateModuleResolutionPolicy(rootDirectory);

  for (const filePath of files) {
    const sourceLayer = sourceLayerForPath(sourceRoot, filePath);
    const content = await readFile(filePath, "utf8");
    if (!sourceLayer) {
      violations.push(formatViolation(sourceRoot, filePath, "未知のsource layerにproduction実装があります"));
      continue;
    }
    if (sourceLayer === "renderer"
      && relativeSourcePath(sourceRoot, filePath) !== "renderer/relicClient.ts"
      && hasWindowRelicAccess(content, filePath)) {
      violations.push(formatViolation(
        sourceRoot,
        filePath,
        "window.relicへの直接アクセスはrenderer/relicClient.tsだけに限定されています"
      ));
    }
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

      const targetPath = resolveLocalModule(filePath, specifier, localFileSet);
      if (!targetPath) {
        violations.push(formatViolation(sourceRoot, filePath, `相対import「${specifier}」を解決できません`));
        continue;
      }
      if (graph.has(targetPath)) graph.get(filePath)?.add(targetPath);

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

export async function validateModuleResolutionPolicy(rootDirectory) {
  const violations = [];
  const packageJson = await readJsonIfPresent(path.join(rootDirectory, "package.json"));
  if (packageJson?.imports) violations.push("package.json: package importsはarchitecture checkが対応するまで使用できません");
  if (packageJson?.workspaces) violations.push("package.json: workspace packageはarchitecture checkが対応するまで使用できません");

  const tsconfig = await readJsonIfPresent(path.join(rootDirectory, "tsconfig.json"));
  if (tsconfig?.compilerOptions?.paths) {
    violations.push("tsconfig.json: compilerOptions.pathsはarchitecture checkが対応するまで使用できません");
  }
  if (tsconfig?.compilerOptions?.baseUrl) {
    violations.push("tsconfig.json: compilerOptions.baseUrlはarchitecture checkが対応するまで使用できません");
  }

  const rootEntries = await readdir(rootDirectory, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (!entry.isFile() || !/^vite(?:\.[^.]+)?\.config\.[cm]?[jt]s$/u.test(entry.name)) continue;
    const content = await readFile(path.join(rootDirectory, entry.name), "utf8");
    if (/\bresolve\s*:\s*\{[\s\S]*?\balias\s*:/u.test(content)) {
      violations.push(`${entry.name}: resolve.aliasはarchitecture checkが対応するまで使用できません`);
    }
  }
  return violations;
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

export function hasWindowRelicAccess(content, fileName = "source.ts") {
  const sourceFile = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    false,
    scriptKindForFile(fileName)
  );
  let found = false;

  function visit(node, shadowedGlobals) {
    const nextShadowedGlobals = shadowedGlobalNamesForScope(node, shadowedGlobals);
    if (
      isWindowRelicPropertyAccess(node, nextShadowedGlobals) ||
      isWindowRelicBinding(node, nextShadowedGlobals)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, (child) => visit(child, nextShadowedGlobals));
  }

  visit(sourceFile, new Set());
  return found;
}

function isWindowRelicPropertyAccess(node, shadowedGlobals) {
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text === "relic"
      && isGlobalWindowExpression(node.expression, shadowedGlobals);
  }
  if (ts.isElementAccessExpression(node)) {
    return staticPropertyName(node.argumentExpression) === "relic"
      && isGlobalWindowExpression(node.expression, shadowedGlobals);
  }
  return false;
}

function isWindowRelicBinding(node, shadowedGlobals) {
  if (!ts.isVariableDeclaration(node)
    || !ts.isObjectBindingPattern(node.name)
    || !node.initializer
    || !isGlobalWindowExpression(node.initializer, shadowedGlobals)) {
    return false;
  }

  return node.name.elements.some((element) => {
    const propertyName = element.propertyName
      ? staticPropertyName(element.propertyName)
      : ts.isIdentifier(element.name) ? element.name.text : null;
    return propertyName === "relic";
  });
}

function isGlobalWindowExpression(expression, shadowedGlobals) {
  const node = unwrapExpression(expression);
  if (ts.isIdentifier(node)) {
    return node.text === "window" && !shadowedGlobals.has("window");
  }
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text === "window"
      && isGlobalThisExpression(node.expression, shadowedGlobals);
  }
  if (ts.isElementAccessExpression(node)) {
    return staticPropertyName(node.argumentExpression) === "window"
      && isGlobalThisExpression(node.expression, shadowedGlobals);
  }
  return false;
}

function isGlobalThisExpression(expression, shadowedGlobals) {
  const node = unwrapExpression(expression);
  return ts.isIdentifier(node)
    && node.text === "globalThis"
    && !shadowedGlobals.has("globalThis");
}

function shadowedGlobalNamesForScope(node, inherited) {
  const bindings = scopeBindingNames(node);
  if (!bindings.has("window") && !bindings.has("globalThis")) return inherited;

  const shadowed = new Set(inherited);
  if (bindings.has("window")) shadowed.add("window");
  if (bindings.has("globalThis")) shadowed.add("globalThis");
  return shadowed;
}

function scopeBindingNames(node) {
  const bindings = new Set();
  if (ts.isSourceFile(node)) {
    for (const statement of node.statements) collectStatementBindings(statement, bindings, false);
    collectFunctionScopedVarBindings(node, bindings);
    return bindings;
  }
  if (ts.isFunctionLike(node)) {
    if (node.name && ts.isIdentifier(node.name)) bindings.add(node.name.text);
    for (const parameter of node.parameters) collectBindingName(parameter.name, bindings);
    if (node.body) collectFunctionScopedVarBindings(node.body, bindings);
    return bindings;
  }
  if (ts.isBlock(node)) {
    for (const statement of node.statements) collectStatementBindings(statement, bindings, true);
    return bindings;
  }
  if (ts.isCatchClause(node) && node.variableDeclaration) {
    collectBindingName(node.variableDeclaration.name, bindings);
    return bindings;
  }
  if (ts.isForStatement(node) && node.initializer && ts.isVariableDeclarationList(node.initializer)) {
    collectBlockScopedDeclarationList(node.initializer, bindings);
    return bindings;
  }
  if ((ts.isForInStatement(node) || ts.isForOfStatement(node))
    && ts.isVariableDeclarationList(node.initializer)) {
    collectBlockScopedDeclarationList(node.initializer, bindings);
  }
  return bindings;
}

function collectStatementBindings(statement, bindings, blockScopedOnly) {
  if (ts.isVariableStatement(statement)) {
    if (!blockScopedOnly || (statement.declarationList.flags & ts.NodeFlags.BlockScoped) !== 0) {
      for (const declaration of statement.declarationList.declarations) {
        collectBindingName(declaration.name, bindings);
      }
    }
    return;
  }
  if ((ts.isFunctionDeclaration(statement)
      || ts.isClassDeclaration(statement)
      || ts.isEnumDeclaration(statement))
    && statement.name) {
    bindings.add(statement.name.text);
    return;
  }
  if (ts.isImportDeclaration(statement) && statement.importClause) {
    const { importClause } = statement;
    if (importClause.name) bindings.add(importClause.name.text);
    const namedBindings = importClause.namedBindings;
    if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      bindings.add(namedBindings.name.text);
    } else if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const element of namedBindings.elements) bindings.add(element.name.text);
    }
    return;
  }
  if (ts.isImportEqualsDeclaration(statement)) bindings.add(statement.name.text);
}

function collectBlockScopedDeclarationList(declarationList, bindings) {
  if ((declarationList.flags & ts.NodeFlags.BlockScoped) === 0) return;
  for (const declaration of declarationList.declarations) {
    collectBindingName(declaration.name, bindings);
  }
}

function collectFunctionScopedVarBindings(root, bindings) {
  function visit(node) {
    if (node !== root && ts.isFunctionLike(node)) return;
    if (ts.isVariableDeclarationList(node)
      && (node.flags & ts.NodeFlags.BlockScoped) === 0) {
      for (const declaration of node.declarations) collectBindingName(declaration.name, bindings);
    }
    ts.forEachChild(node, visit);
  }
  visit(root);
}

function collectBindingName(name, bindings) {
  if (ts.isIdentifier(name)) {
    bindings.add(name.text);
    return;
  }
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue;
    collectBindingName(element.name, bindings);
  }
}

function unwrapExpression(expression) {
  let node = expression;
  while (ts.isParenthesizedExpression(node)
    || ts.isAsExpression(node)
    || ts.isTypeAssertionExpression(node)
    || ts.isNonNullExpression(node)
    || ts.isSatisfiesExpression(node)) {
    node = node.expression;
  }
  return node;
}

function staticPropertyName(node) {
  if (!node) return null;
  const value = unwrapExpression(node);
  if (ts.isIdentifier(value) || ts.isStringLiteralLike(value)) return value.text;
  return null;
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
    if (isTestSupportSource(entry.name)) continue;
    files.push(path.resolve(filePath));
  }
  return files;
}

async function collectLocalFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "test") continue;
      files.push(...await collectLocalFiles(filePath));
      continue;
    }
    if (entry.isFile()
      && localModuleExtensions.includes(path.extname(entry.name))
      && !isTestSupportSource(entry.name)) {
      files.push(path.resolve(filePath));
    }
  }
  return files;
}

function isTestSupportSource(fileName) {
  return /\.(?:test|spec)\.[^.]+$/u.test(fileName)
    || /(?:TestHelpers|testHelpers)\.[^.]+$/u.test(fileName)
    || /\.d\.(?:cts|mts|ts)$/u.test(fileName);
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
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
        ...localModuleExtensions.map((extension) => `${basePath}${extension}`),
        ...localModuleExtensions.map((extension) => path.join(basePath, `index${extension}`))
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
