#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const maxConcurrentWrites = 32;

export async function generateLargeWorkspace({ directoryCount = 20, fileCount = 1000, outputPath }) {
  const resolvedOutputPath = path.resolve(outputPath);
  await mkdir(resolvedOutputPath, { recursive: true });

  const directoryNames = Array.from(
    { length: Math.min(directoryCount, fileCount) },
    (_, index) => `section-${String(index).padStart(3, "0")}`
  );
  await Promise.all(directoryNames.map((name) => mkdir(path.join(resolvedOutputPath, name), { recursive: true })));

  const fingerprint = createHash("sha256");
  const files = Array.from({ length: fileCount }, (_, index) => {
    const directoryName = `section-${String(index % directoryCount).padStart(3, "0")}`;
    const fileName = `note-${String(index + 1).padStart(5, "0")}.md`;
    const relativePath = path.posix.join(directoryName, fileName);
    const content = renderLargeWorkspaceNote(index, fileCount);
    fingerprint.update(relativePath);
    fingerprint.update("\0");
    fingerprint.update(content);
    fingerprint.update("\0");
    return { content, relativePath };
  });

  await mapWithConcurrency(files, maxConcurrentWrites, ({ content, relativePath }) =>
    writeFile(path.join(resolvedOutputPath, relativePath), content, "utf8")
  );

  return {
    directoryCount,
    fileCount,
    fingerprint: fingerprint.digest("hex"),
    outputPath: resolvedOutputPath
  };
}

export function renderLargeWorkspaceNote(index, fileCount) {
  const linkedIndex = ((index + 7) % fileCount) + 1;
  return `${[
    "---",
    "tags:",
    `  - tag-${index % 12}`,
    `aliases: [alias-${index + 1}]`,
    "chronicle:",
    `  - [メイン暦, [[${2000 + (index % 30)}, null], [${2000 + (index % 30)}, null]]]`,
    "---",
    `# Note ${index + 1}`,
    "",
    `本文 ${index + 1}`,
    `[[note-${String(linkedIndex).padStart(5, "0")}]]`,
    "",
    "- 大規模ワークスペースの検索確認用テキスト",
    "- バックリンク、タグ、フロントマター、チャートの計測用"
  ].join("\n")}\n`;
}

export function positiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== String(value).trim()) {
    throw new Error(`--${name} must be a positive integer.`);
  }
  return parsed;
}

async function mapWithConcurrency(values, concurrency, operation) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      await operation(values[index]);
    }
  });
  await Promise.all(workers);
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
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fileCount = positiveInteger(args.files ?? "1000", "files");
  const directoryCount = positiveInteger(args.directories ?? "20", "directories");
  const outputPath = path.resolve(args.output ?? path.join(os.tmpdir(), `relic-large-workspace-${fileCount}`));
  const result = await generateLargeWorkspace({ directoryCount, fileCount, outputPath });
  console.log(`Generated ${result.fileCount} Markdown files in ${result.outputPath}`);
  console.log(`Fixture fingerprint: ${result.fingerprint}`);
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
