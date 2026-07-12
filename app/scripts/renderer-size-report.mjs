import { execFile } from "node:child_process";
import { readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { promisify } from "node:util";

import {
  compareLowerIsBetterMetrics,
  readBaseline,
  renderComparison,
  writeBaseline
} from "./performance-baseline.mjs";

const execFileAsync = promisify(execFile);
const defaultOutputDirectory = path.join(process.cwd(), ".vite", `renderer-size-${process.pid}`);
const manifestFileName = "renderer-size-manifest.json";
const requiredLazyRendererEntries = [
  "node_modules/@terrastruct/d2/dist/browser/index.js",
  "node_modules/mermaid/dist/mermaid.core.mjs"
];

export async function buildRendererBundle(outputDirectory = defaultOutputDirectory) {
  await rm(outputDirectory, { force: true, recursive: true });
  await execFileAsync("pnpm", [
    "exec",
    "vite",
    "build",
    "--config",
    "vite.renderer.config.ts",
    "--outDir",
    outputDirectory,
    "--emptyOutDir",
    "--manifest",
    manifestFileName,
    "--logLevel",
    "silent"
  ], { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 16 });
}

export async function collectRendererBundleReport(outputDirectory, manifestFile = manifestFileName) {
  const manifest = JSON.parse(await readFile(path.join(outputDirectory, manifestFile), "utf8"));
  const allFiles = await walkFiles(outputDirectory);
  const initialManifestKeys = collectInitialManifestKeys(manifest);
  const lazyEntryViolations = rendererLazyEntryViolations(manifest, requiredLazyRendererEntries);
  if (lazyEntryViolations.length > 0) {
    throw new Error(`Renderer lazy chunk boundary failed:\n${lazyEntryViolations.join("\n")}`);
  }
  const initialFiles = new Set();
  const logicalNames = new Map();

  for (const [key, entry] of Object.entries(manifest)) {
    if (entry.file) logicalNames.set(entry.file, manifestEntryLogicalName(entry));
    for (const asset of entry.assets ?? []) {
      logicalNames.set(asset, findManifestLogicalName(manifest, asset));
    }
    for (const cssFile of entry.css ?? []) {
      logicalNames.set(cssFile, findManifestLogicalName(manifest, cssFile));
    }

    if (!initialManifestKeys.has(key)) continue;
    if (entry.file) initialFiles.add(entry.file);
    for (const cssFile of entry.css ?? []) initialFiles.add(cssFile);
  }

  const files = [];
  for (const relativePath of allFiles) {
    if (relativePath === manifestFile || relativePath === "index.html") continue;

    const absolutePath = path.join(outputDirectory, relativePath);
    const [fileStats, content] = await Promise.all([stat(absolutePath), readFile(absolutePath)]);
    const type = assetType(relativePath);
    const phase = type === "asset" ? "asset" : (initialFiles.has(relativePath) ? "initial" : "deferred");
    const logicalName = logicalNames.get(relativePath) ?? stableAssetName(relativePath);
    files.push({
      gzipBytes: gzipSync(content).byteLength,
      id: `${phase}:${type}:${logicalName}`,
      logicalName,
      path: relativePath,
      phase,
      rawBytes: fileStats.size,
      type
    });
  }

  files.sort((left, right) =>
    phaseOrder(left.phase) - phaseOrder(right.phase) ||
    typeOrder(left.type) - typeOrder(right.type) ||
    right.rawBytes - left.rawBytes ||
    left.id.localeCompare(right.id, "en")
  );

  const katexFontViolations = rendererKatexFontAssetViolations(files);
  if (katexFontViolations.length > 0) {
    throw new Error(`KaTeX font asset boundary failed:\n${katexFontViolations.join("\n")}`);
  }

  const totals = aggregateBundleTotals(files);
  return {
    files,
    kind: "renderer-bundle",
    metrics: rendererBundleMetrics(files, totals),
    schemaVersion: 1,
    totals
  };
}

export function collectInitialManifestKeys(manifest) {
  const initialKeys = new Set();
  const queue = Object.entries(manifest)
    .filter(([, entry]) => entry.isEntry)
    .map(([key]) => key);

  while (queue.length > 0) {
    const key = queue.shift();
    if (!key || initialKeys.has(key)) continue;
    initialKeys.add(key);
    for (const importedKey of manifest[key]?.imports ?? []) queue.push(importedKey);
  }

  return initialKeys;
}

export function rendererLazyEntryViolations(manifest, requiredSources) {
  const initialKeys = collectInitialManifestKeys(manifest);
  const initialEntries = [...initialKeys].map((key) => manifest[key]).filter(Boolean);
  const dynamicImports = new Set(initialEntries.flatMap((entry) => entry.dynamicImports ?? []));
  const violations = [];

  for (const requiredSource of requiredSources) {
    const match = Object.entries(manifest).find(([, entry]) => entry.src === requiredSource);
    if (!match) {
      violations.push(`Missing renderer dependency entry: ${requiredSource}`);
      continue;
    }

    const [key] = match;
    if (initialKeys.has(key)) {
      violations.push(`Renderer dependency is loaded initially: ${requiredSource}`);
    }
    if (!dynamicImports.has(key)) {
      violations.push(`Renderer dependency is not a direct lazy entry: ${requiredSource}`);
    }
  }

  return violations;
}

export function rendererKatexFontAssetViolations(files) {
  const katexFonts = files.filter((file) =>
    file.type === "asset" && path.basename(file.logicalName).startsWith("KaTeX_")
  );
  if (katexFonts.length === 0) return ["No emitted KaTeX WOFF2 font assets were found."];

  return katexFonts
    .filter((file) => !file.logicalName.toLocaleLowerCase().endsWith(".woff2"))
    .map((file) => `Non-WOFF2 KaTeX font asset was emitted: ${file.logicalName}`);
}

export function aggregateBundleTotals(files) {
  const totals = {};
  for (const phase of ["initial", "deferred", "asset"]) {
    totals[phase] = {};
    for (const type of ["javascript", "stylesheet", "asset"]) {
      const selected = files.filter((file) => file.phase === phase && file.type === type);
      totals[phase][type] = {
        files: selected.length,
        gzipBytes: selected.reduce((sum, file) => sum + file.gzipBytes, 0),
        rawBytes: selected.reduce((sum, file) => sum + file.rawBytes, 0)
      };
    }
  }
  return totals;
}

export function rendererBundleMetrics(files, totals) {
  const metrics = {};
  for (const phase of ["initial", "deferred", "asset"]) {
    for (const type of ["javascript", "stylesheet", "asset"]) {
      const total = totals[phase][type];
      metrics[`total.${phase}.${type}.gzipBytes`] = total.gzipBytes;
      metrics[`total.${phase}.${type}.rawBytes`] = total.rawBytes;
    }
  }
  for (const file of files) metrics[`file.${file.id}.gzipBytes`] = file.gzipBytes;
  return metrics;
}

export function rendererBundleBaseline(report) {
  return {
    kind: report.kind,
    metrics: report.metrics,
    schemaVersion: report.schemaVersion
  };
}

export function renderRendererBundleReport(report) {
  const reportedFiles = report.files.filter((file) => file.phase !== "asset");
  const visibleFiles = reportedFiles.filter((file) => file.phase === "initial")
    .concat(reportedFiles.filter((file) => file.phase === "deferred").slice(0, 20));
  const lines = [
    "Renderer bundle sizes",
    "phase\ttype\traw bytes\tgzip bytes\tname"
  ];
  for (const file of visibleFiles) {
    lines.push(`${file.phase}\t${file.type}\t${file.rawBytes}\t${file.gzipBytes}\t${file.logicalName}`);
  }
  if (visibleFiles.length < reportedFiles.length) {
    lines.push(`... ${reportedFiles.length - visibleFiles.length} smaller deferred file(s) omitted`);
  }
  lines.push("", "Totals", "phase\ttype\tfiles\traw bytes\tgzip bytes");
  for (const phase of ["initial", "deferred", "asset"]) {
    for (const type of ["javascript", "stylesheet", "asset"]) {
      const total = report.totals[phase][type];
      if (total.files === 0) continue;
      lines.push(`${phase}\t${type}\t${total.files}\t${total.rawBytes}\t${total.gzipBytes}`);
    }
  }
  return lines.join("\n");
}

function findManifestLogicalName(manifest, file) {
  const entry = Object.values(manifest).find((candidate) => candidate.file === file);
  if (entry) return manifestEntryLogicalName(entry);
  return stableAssetName(file);
}

function manifestEntryLogicalName(entry) {
  if (entry.name) return entry.name;
  if (entry.src && !path.basename(entry.src).startsWith("_")) return entry.src;
  return stableAssetName(entry.file);
}

async function walkFiles(directory, rootDirectory = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(absolutePath, rootDirectory));
    } else if (entry.isFile()) {
      files.push(path.relative(rootDirectory, absolutePath).split(path.sep).join("/"));
    }
  }
  return files;
}

function stableAssetName(filePath) {
  const extension = path.extname(filePath);
  const baseName = path.basename(filePath, extension).replace(/-[A-Za-z0-9_-]{8,12}$/, "");
  return `${baseName}${extension}`;
}

function assetType(filePath) {
  if (filePath.endsWith(".js")) return "javascript";
  if (filePath.endsWith(".css")) return "stylesheet";
  return "asset";
}

function phaseOrder(phase) {
  return ["initial", "deferred", "asset"].indexOf(phase);
}

function typeOrder(type) {
  return ["javascript", "stylesheet", "asset"].indexOf(type);
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDirectory = path.resolve(args["out-dir"] ?? defaultOutputDirectory);
  const maxRegressionPercent = Number(args["max-regression-percent"] ?? "5");

  try {
    await buildRendererBundle(outputDirectory);
    const report = await collectRendererBundleReport(outputDirectory);
    console.log(renderRendererBundleReport(report));

    if (args["write-baseline"]) {
      const baselinePath = await writeBaseline(args["write-baseline"], rendererBundleBaseline(report));
      console.log(`\nBaseline written: ${baselinePath}`);
    }

    if (args.baseline) {
      const baseline = await readBaseline(path.resolve(args.baseline), "renderer-bundle");
      const comparison = compareLowerIsBetterMetrics(report.metrics, baseline.metrics, maxRegressionPercent);
      console.log(`\n${renderComparison(comparison)}`);
      if (comparison.regressions.length > 0) process.exitCode = 1;
    }
  } finally {
    if (!args["keep-output"]) await rm(outputDirectory, { force: true, recursive: true });
  }
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
