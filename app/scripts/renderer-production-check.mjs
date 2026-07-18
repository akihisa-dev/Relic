import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const defaultOutputDirectory = path.join(process.cwd(), ".vite", `renderer-production-${process.pid}`);
const manifestFileName = "renderer-production-manifest.json";
const requiredDeferredRendererSources = [
  "node_modules/@terrastruct/d2/dist/browser/index.js",
  "node_modules/mermaid/dist/mermaid.core.mjs"
];

export async function buildRendererProduction(outputDirectory = defaultOutputDirectory) {
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

export async function checkRendererProductionManifest(
  outputDirectory,
  manifestFile = manifestFileName
) {
  const manifest = JSON.parse(await readFile(path.join(outputDirectory, manifestFile), "utf8"));
  const violations = rendererInitialLoadViolations(manifest, requiredDeferredRendererSources);
  if (violations.length > 0) {
    throw new Error(`Renderer initial-load boundary failed:\n${violations.join("\n")}`);
  }
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

export function rendererInitialLoadViolations(manifest, requiredSources) {
  const initialKeys = collectInitialManifestKeys(manifest);
  const violations = [];

  for (const requiredSource of requiredSources) {
    const match = Object.entries(manifest).find(([, entry]) =>
      canonicalRendererSource(entry.src) === requiredSource
    );
    if (!match) {
      violations.push(`Required renderer dependency was not emitted: ${requiredSource}`);
      continue;
    }

    const [key] = match;
    if (initialKeys.has(key)) {
      violations.push(`Renderer dependency is loaded initially: ${requiredSource}`);
    }
  }

  return violations;
}

function canonicalRendererSource(source) {
  return source?.replace(
    /^node_modules\/\.pnpm\/[^/]+\/node_modules\//u,
    "node_modules/"
  );
}

async function main() {
  try {
    await buildRendererProduction();
    await checkRendererProductionManifest(defaultOutputDirectory);
    console.log("Renderer production check passed: Mermaid and D2 remain outside the initial static import graph.");
  } finally {
    await rm(defaultOutputDirectory, { force: true, recursive: true });
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
