import { chmod, mkdir } from "node:fs/promises";
import path from "node:path";

import { atomicWriteTextFile } from "../files/atomicWrite";

export const privateSettingsDirectoryMode = 0o700;
export const privateSettingsFileMode = 0o600;

interface SecureSettingsFileOperations {
  chmod: (targetPath: string, mode: number) => Promise<void>;
  mkdir: (directoryPath: string, options: { mode: number; recursive: true }) => Promise<string | undefined>;
}

const defaultOperations: SecureSettingsFileOperations = {
  chmod: (targetPath, mode) => chmod(targetPath, mode),
  mkdir: (directoryPath, options) => mkdir(directoryPath, options)
};

export async function ensurePrivateSettingsDirectory(
  directoryPath: string,
  operations: SecureSettingsFileOperations = defaultOperations
): Promise<void> {
  await operations.mkdir(directoryPath, { recursive: true, mode: privateSettingsDirectoryMode });
  await chmodPrivate(directoryPath, privateSettingsDirectoryMode, operations);
}

export async function writePrivateSettingsTextFile(
  filePath: string,
  content: string,
  operations: SecureSettingsFileOperations = defaultOperations
): Promise<void> {
  await ensurePrivateSettingsDirectory(path.dirname(filePath), operations);
  await atomicWriteTextFile(filePath, content, undefined, {
    beforeRename: (temporaryPath) => chmodPrivate(temporaryPath, privateSettingsFileMode, operations),
    mode: privateSettingsFileMode
  });
}

async function chmodPrivate(
  targetPath: string,
  mode: number,
  operations: SecureSettingsFileOperations
): Promise<void> {
  try {
    await operations.chmod(targetPath, mode);
  } catch {
    throw new Error("設定ファイルの権限を保護できませんでした。");
  }
}
