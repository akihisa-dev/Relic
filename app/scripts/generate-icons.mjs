import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const repoDir = path.resolve(appDir, "..");
const sourcePng = path.join(repoDir, "docs", "logo", "relic.png");
const assetsDir = path.join(appDir, "assets");
const iconsetDir = path.join(assetsDir, "icon.iconset");
const icnsPath = path.join(assetsDir, "icon.icns");
const icoPath = path.join(assetsDir, "icon.ico");

if (process.platform !== "darwin") {
  throw new Error("Icon generation currently requires macOS because it uses the built-in sips command.");
}

const iconsetImages = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024]
];

const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const icnsImages = [
  ["icp4", "icon_16x16.png"],
  ["icp5", "icon_32x32.png"],
  ["icp6", "icon_32x32@2x.png"],
  ["ic07", "icon_128x128.png"],
  ["ic08", "icon_256x256.png"],
  ["ic09", "icon_512x512.png"],
  ["ic10", "icon_512x512@2x.png"]
];

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file is missing: ${filePath}`);
  }
}

function ensureCommand(command) {
  try {
    execFileSync("/usr/bin/which", [command], { stdio: "ignore" });
  } catch {
    throw new Error(`Required command is missing: ${command}`);
  }
}

function resizePng(size, outputPath) {
  execFileSync("sips", ["-z", String(size), String(size), sourcePng, "--out", outputPath], {
    stdio: "ignore"
  });
}

function writeIco(entries, outputPath) {
  const headerSize = 6;
  const entrySize = 16;
  let imageOffset = headerSize + entries.length * entrySize;
  const header = Buffer.alloc(imageOffset);

  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  entries.forEach(({ size, buffer }, index) => {
    const entryOffset = headerSize + index * entrySize;
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset);
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(buffer.length, entryOffset + 8);
    header.writeUInt32LE(imageOffset, entryOffset + 12);
    imageOffset += buffer.length;
  });

  fs.writeFileSync(outputPath, Buffer.concat([header, ...entries.map((entry) => entry.buffer)]));
}

function writeIcns(entries, outputPath) {
  const chunks = entries.map(({ type, buffer }) => {
    const chunk = Buffer.alloc(8);
    chunk.write(type, 0, 4, "ascii");
    chunk.writeUInt32BE(buffer.length + 8, 4);
    return Buffer.concat([chunk, buffer]);
  });
  const totalLength = 8 + chunks.reduce((length, chunk) => length + chunk.length, 0);
  const header = Buffer.alloc(8);
  header.write("icns", 0, 4, "ascii");
  header.writeUInt32BE(totalLength, 4);
  fs.writeFileSync(outputPath, Buffer.concat([header, ...chunks]));
}

ensureFile(sourcePng);
ensureCommand("sips");

fs.rmSync(iconsetDir, { recursive: true, force: true });
fs.mkdirSync(iconsetDir, { recursive: true });

for (const [fileName, size] of iconsetImages) {
  resizePng(size, path.join(iconsetDir, fileName));
}

writeIcns(
  icnsImages.map(([type, fileName]) => ({
    type,
    buffer: fs.readFileSync(path.join(iconsetDir, fileName))
  })),
  icnsPath
);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "relic-icons-"));
try {
  const icoEntries = icoSizes.map((size) => {
    const outputPath = path.join(tempDir, `icon-${size}.png`);
    resizePng(size, outputPath);
    return { size, buffer: fs.readFileSync(outputPath) };
  });
  writeIco(icoEntries, icoPath);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log(`Generated icons from ${path.relative(repoDir, sourcePng)}`);
