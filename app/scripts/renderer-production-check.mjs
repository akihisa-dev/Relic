import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const defaultOutputDirectory = path.join(process.cwd(), ".vite", `renderer-production-${process.pid}`);
const manifestFileName = "renderer-production-manifest.json";
export const requiredDeferredRendererSources = [
  "node_modules/@terrastruct/d2/dist/browser/index.js",
  "node_modules/mermaid/dist/mermaid.core.mjs",
  "src/renderer/previewMarkdown.ts"
];
export const requiredDeferredRendererChunks = [
  {
    dependency: "marked",
    chunkName: "markdown-parser",
    importedBySource: "src/renderer/previewMarkdown.ts"
  },
  {
    dependency: "highlight.js",
    chunkName: "markdown-highlight",
    importedBySource: "src/renderer/previewMarkdown.ts"
  }
];
export const requiredInitialRendererChunks = [
  {
    dependencies: "KaTeX and DOMPurify",
    chunkName: "markdown-runtime"
  }
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
  const violations = rendererInitialLoadViolations(
    manifest,
    requiredDeferredRendererSources,
    requiredDeferredRendererChunks,
    requiredInitialRendererChunks
  );
  if (violations.length > 0) {
    throw new Error(`Renderer initial-load boundary failed:\n${violations.join("\n")}`);
  }
}

export function collectInitialManifestKeys(manifest) {
  const entryKeys = Object.entries(manifest)
    .filter(([, entry]) => entry.isEntry)
    .map(([key]) => key);

  return collectStaticManifestKeys(manifest, entryKeys);
}

export function collectStaticManifestKeys(manifest, startingKeys) {
  const staticKeys = new Set();
  const queue = [...startingKeys];

  while (queue.length > 0) {
    const key = queue.shift();
    if (!key || staticKeys.has(key)) continue;
    staticKeys.add(key);
    for (const importedKey of manifest[key]?.imports ?? []) queue.push(importedKey);
  }

  return staticKeys;
}

export function rendererInitialLoadViolations(
  manifest,
  requiredSources,
  requiredDeferredChunks = [],
  requiredInitialChunks = []
) {
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

  for (const requirement of requiredDeferredChunks) {
    const importer = Object.entries(manifest).find(([, entry]) =>
      canonicalRendererSource(entry.src) === requirement.importedBySource
    );
    const chunks = Object.entries(manifest).filter(([, entry]) =>
      entry.name === requirement.chunkName
    );

    if (!importer) {
      violations.push(
        `Required renderer importer was not emitted for ${requirement.dependency}: ${requirement.importedBySource}`
      );
      continue;
    }
    if (chunks.length === 0) {
      violations.push(
        `Required deferred renderer chunk was not emitted for ${requirement.dependency}: ${requirement.chunkName}`
      );
      continue;
    }
    if (chunks.length > 1) {
      violations.push(
        `Deferred renderer chunk name is ambiguous for ${requirement.dependency}: ${requirement.chunkName}`
      );
      continue;
    }

    const [chunkKey] = chunks[0];
    const [importerKey] = importer;
    const importerStaticKeys = collectStaticManifestKeys(manifest, [importerKey]);
    if (!importerStaticKeys.has(chunkKey)) {
      violations.push(
        `Renderer dependency is outside the protected static path ${requirement.importedBySource} -> ${requirement.dependency}: ${requirement.chunkName}`
      );
    }
    if (initialKeys.has(chunkKey)) {
      violations.push(
        `Renderer dependency chunk is loaded initially for ${requirement.dependency}: ${requirement.chunkName}`
      );
    }
  }

  for (const requirement of requiredInitialChunks) {
    const chunks = Object.entries(manifest).filter(([, entry]) =>
      entry.name === requirement.chunkName
    );

    if (chunks.length === 0) {
      violations.push(
        `Required initial renderer chunk was not emitted for ${requirement.dependencies}: ${requirement.chunkName}`
      );
      continue;
    }
    if (chunks.length > 1) {
      violations.push(
        `Initial renderer chunk name is ambiguous for ${requirement.dependencies}: ${requirement.chunkName}`
      );
      continue;
    }

    const [chunkKey] = chunks[0];
    if (!initialKeys.has(chunkKey)) {
      violations.push(
        `Renderer dependency chunk is not loaded initially for ${requirement.dependencies}: ${requirement.chunkName}`
      );
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
    console.log("Renderer production check passed: marked, highlight.js, Markdown preview, Mermaid, and D2 remain deferred while KaTeX and DOMPurify remain in the initial static import graph.");
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
