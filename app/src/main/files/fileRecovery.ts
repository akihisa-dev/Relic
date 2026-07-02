import { readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import type { FileRecoveryEntry, FileRecoverySnapshot } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import {
  ensurePrivateSettingsDirectory,
  privateSettingsFileMode
} from "../settings/secureSettingsFile";
import { errorDetails } from "./fileSystem";

const maxRecoverySnapshotsPerFile = 30;
const recoveryFileExtension = ".json";

export async function createFileRecoverySnapshot(
  userDataPath: string,
  workspaceId: string,
  relativePath: string,
  content: string
): Promise<RelicResult<void>> {
  try {
    const createdAt = new Date().toISOString();
    const snapshotDir = recoverySnapshotDir(userDataPath, workspaceId, relativePath);
    await ensurePrivateSettingsDirectory(snapshotDir);

    const snapshot: FileRecoverySnapshot = {
      content,
      createdAt,
      path: relativePath,
      size: Buffer.byteLength(content, "utf8"),
      workspaceId
    };
    const fileName = `${createdAt.replace(/[:.]/g, "-")}-${hashText(content).slice(0, 12)}${recoveryFileExtension}`;
    await writeFile(path.join(snapshotDir, fileName), JSON.stringify(snapshot), {
      encoding: "utf8",
      mode: privateSettingsFileMode
    });
    await pruneRecoverySnapshots(snapshotDir, maxRecoverySnapshotsPerFile);

    return ok(undefined);
  } catch (error) {
    return fail("FILE_RECOVERY_SAVE_FAILED", "復元版を保存できませんでした。", errorDetails(error));
  }
}

export async function listFileRecoverySnapshots(
  userDataPath: string,
  workspaceId: string,
  relativePath: string
): Promise<RelicResult<FileRecoveryEntry[]>> {
  try {
    const snapshotDir = recoverySnapshotDir(userDataPath, workspaceId, relativePath);
    const files = await readRecoverySnapshotFileNames(snapshotDir);
    const entries: FileRecoveryEntry[] = [];

    for (const fileName of files) {
      const snapshot = await readSnapshotFile(path.join(snapshotDir, fileName));
      if (!snapshot || snapshot.workspaceId !== workspaceId || snapshot.path !== relativePath) continue;
      entries.push({
        createdAt: snapshot.createdAt,
        id: fileName,
        path: snapshot.path,
        size: snapshot.size
      });
    }

    return ok(entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  } catch (error) {
    return fail("FILE_RECOVERY_LIST_FAILED", "復元版を読み込めませんでした。", errorDetails(error));
  }
}

export async function readFileRecoverySnapshot(
  userDataPath: string,
  workspaceId: string,
  relativePath: string,
  snapshotId: string
): Promise<RelicResult<FileRecoverySnapshot>> {
  if (!isRecoverySnapshotId(snapshotId)) {
    return fail("FILE_RECOVERY_INVALID_INPUT", "復元版の指定が正しくありません。");
  }

  try {
    const snapshotPath = path.join(recoverySnapshotDir(userDataPath, workspaceId, relativePath), snapshotId);
    const snapshot = await readSnapshotFile(snapshotPath);
    if (!snapshot || snapshot.workspaceId !== workspaceId || snapshot.path !== relativePath) {
      return fail("FILE_RECOVERY_NOT_FOUND", "復元版が見つかりませんでした。");
    }

    return ok(snapshot);
  } catch (error) {
    return fail("FILE_RECOVERY_READ_FAILED", "復元版を読み込めませんでした。", errorDetails(error));
  }
}

function recoverySnapshotDir(userDataPath: string, workspaceId: string, relativePath: string): string {
  return path.join(userDataPath, "file-recovery", workspaceId, hashText(relativePath));
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function readRecoverySnapshotFileNames(snapshotDir: string): Promise<string[]> {
  try {
    const entries = await readdir(snapshotDir, { withFileTypes: true });
    const names: string[] = [];

    for (const entry of entries) {
      if (entry.isFile() && isRecoverySnapshotId(entry.name)) {
        names.push(entry.name);
      }
    }

    return names;
  } catch (error) {
    if (isNotFoundError(error)) return [];
    throw error;
  }
}

async function readSnapshotFile(snapshotPath: string): Promise<FileRecoverySnapshot | null> {
  const raw = await readFile(snapshotPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<FileRecoverySnapshot>;

  if (
    typeof parsed.content !== "string" ||
    typeof parsed.createdAt !== "string" ||
    typeof parsed.path !== "string" ||
    typeof parsed.size !== "number" ||
    typeof parsed.workspaceId !== "string"
  ) {
    return null;
  }

  return {
    content: parsed.content,
    createdAt: parsed.createdAt,
    path: parsed.path,
    size: parsed.size,
    workspaceId: parsed.workspaceId
  };
}

async function pruneRecoverySnapshots(snapshotDir: string, keepCount: number): Promise<void> {
  const files = await readRecoverySnapshotFileNames(snapshotDir);
  const withStats = await Promise.all(files.map(async (fileName) => ({
    fileName,
    mtimeMs: (await stat(path.join(snapshotDir, fileName))).mtimeMs
  })));
  const staleFiles = withStats
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(keepCount);

  await Promise.all(staleFiles.map((entry) => unlink(path.join(snapshotDir, entry.fileName)).catch(() => undefined)));
}

function isRecoverySnapshotId(value: string): boolean {
  return /^[0-9T-Za-z-]+-[a-f0-9]{12}\.json$/.test(value);
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as NodeJS.ErrnoException).code === "ENOENT";
}
