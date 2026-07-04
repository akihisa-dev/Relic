#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const fileCount = positiveInteger(args.files ?? "1000", "files");
const directoryCount = positiveInteger(args.directories ?? "20", "directories");
const outputPath = path.resolve(args.output ?? path.join(os.tmpdir(), `relic-large-workspace-${fileCount}`));

await mkdir(outputPath, { recursive: true });

for (let index = 0; index < fileCount; index += 1) {
  const directoryName = `section-${String(index % directoryCount).padStart(3, "0")}`;
  const directoryPath = path.join(outputPath, directoryName);
  await mkdir(directoryPath, { recursive: true });

  const fileName = `note-${String(index + 1).padStart(5, "0")}.md`;
  const linkedIndex = ((index + 7) % fileCount) + 1;
  const content = [
    "---",
    "tags:",
    `  - tag-${index % 12}`,
    `aliases: [alias-${index + 1}]`,
    "chronicle:",
    `  - title: event-${index + 1}`,
    `    start: ${2000 + (index % 30)}`,
    "---",
    `# Note ${index + 1}`,
    "",
    `本文 ${index + 1}`,
    `[[note-${String(linkedIndex).padStart(5, "0")}]]`,
    "",
    "- 大規模ワークスペースの検索確認用テキスト",
    "- バックリンク、タグ、フロントマター、チャートの計測用"
  ].join("\n");

  await writeFile(path.join(directoryPath, fileName), `${content}\n`, "utf8");
}

console.log(`Generated ${fileCount} Markdown files in ${outputPath}`);

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;

    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function positiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer.`);
  }
  return parsed;
}
