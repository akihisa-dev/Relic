import { chmod, mkdir } from "node:fs/promises";
import path from "node:path";

import { atomicWriteTextFile } from "../files/atomicWrite";

export const privateSettingsDirectoryMode = 0o700;
export const privateSettingsFileMode = 0o600;

export async function ensurePrivateSettingsDirectory(directoryPath: string): Promise<void> {
  await mkdir(directoryPath, { recursive: true, mode: privateSettingsDirectoryMode });
  await chmodPrivate(directoryPath, privateSettingsDirectoryMode);
}

export async function writePrivateSettingsTextFile(filePath: string, content: string): Promise<void> {
  await ensurePrivateSettingsDirectory(path.dirname(filePath));
  await atomicWriteTextFile(filePath, content, undefined, { mode: privateSettingsFileMode });
  await chmodPrivate(filePath, privateSettingsFileMode);
}

async function chmodPrivate(targetPath: string, mode: number): Promise<void> {
  await chmod(targetPath, mode).catch(() => undefined);
}
