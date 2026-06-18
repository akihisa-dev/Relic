import { execFile } from "node:child_process";
import { readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const outputDirectory = path.join(process.cwd(), ".vite", "renderer-size");
const assetsDirectory = path.join(outputDirectory, "assets");

await rm(outputDirectory, { force: true, recursive: true });
await execFileAsync("pnpm", [
  "exec",
  "vite",
  "build",
  "--config",
  "vite.renderer.config.ts",
  "--outDir",
  outputDirectory,
  "--emptyOutDir"
], { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 16 });

const entries = await collectAssetSizes(assetsDirectory);

console.log("Renderer chunk sizes");
console.log("name\traw bytes\tgzip bytes");
for (const entry of entries) {
  console.log(`${entry.name}\t${entry.rawBytes}\t${entry.gzipBytes}`);
}

async function collectAssetSizes(directory) {
  const names = await readdir(directory);
  const entries = await Promise.all(
    names
      .filter((name) => name.endsWith(".js") || name.endsWith(".css"))
      .map(async (name) => {
        const filePath = path.join(directory, name);
        const [fileStats, content] = await Promise.all([
          stat(filePath),
          readFile(filePath)
        ]);

        return {
          gzipBytes: gzipSync(content).byteLength,
          name,
          rawBytes: fileStats.size
        };
      })
  );

  return entries.sort((a, b) => b.rawBytes - a.rawBytes || a.name.localeCompare(b.name));
}
