import { createHash } from "node:crypto";
import type { Stats } from "node:fs";
import { open, readFile, stat } from "node:fs/promises";

import { ensurePrivateSettingsDirectory, writePrivateSettingsTextFile } from "../settings/secureSettingsFile";

export interface WorkspaceFileIndexOperations {
  mkdir(directoryPath: string, options: { recursive: true }): Promise<unknown>;
  readCache(filePath: string): Promise<string>;
  readFile(filePath: string): Promise<string>;
  readHead(filePath: string, byteLength: number): Promise<string>;
  stat(filePath: string): Promise<Stats>;
  writeCache(filePath: string, content: string): Promise<void>;
}

async function readFileHead(filePath: string, byteLength: number): Promise<string> {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(byteLength);
    const result = await handle.read(buffer, 0, byteLength, 0);
    return buffer.subarray(0, result.bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

export const defaultWorkspaceFileIndexOperations: WorkspaceFileIndexOperations = {
  mkdir: (directoryPath) => ensurePrivateSettingsDirectory(directoryPath),
  readCache: (filePath) => readFile(filePath, "utf8"),
  readFile: (filePath) => readFile(filePath, "utf8"),
  readHead: readFileHead,
  stat,
  writeCache: writePrivateSettingsTextFile
};

export function workspaceFileContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
