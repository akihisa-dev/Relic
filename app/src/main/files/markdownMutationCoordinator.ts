import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";

import { maxMarkdownReadBytes } from "../../shared/ipc/files";

/**
 * The mutation queue is deliberately kept in the Main process.  Renderer
 * requests can arrive concurrently, while the Markdown file remains the
 * source of truth.  A failed task must not poison the next task for the same
 * file, and unrelated files must remain parallel.
 */
const mutationQueues = new Map<string, Promise<void>>();

export interface MarkdownMutationOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
  realpath(filePath: string): Promise<string>;
  stat(filePath: string): Promise<Pick<Stats, "dev" | "ino" | "mtimeMs" | "size">>;
}

export interface MarkdownMutationSnapshot {
  content: string;
  token: MarkdownMutationToken;
}

interface MarkdownMutationToken {
  contentHash: string;
  dev: number;
  ino: number;
  mtimeMs: number;
  size: number;
}

export class MarkdownMutationConflictError extends Error {
  constructor(message = "Markdownファイルが外部で変更されています。") {
    super(message);
    this.name = "MarkdownMutationConflictError";
  }
}

export const maxMarkdownMutationReadBytes = maxMarkdownReadBytes;

export class MarkdownMutationReadLimitError extends Error {
  readonly code = "MARKDOWN_MUTATION_READ_TOO_LARGE";

  constructor() {
    super("Markdown mutation read budget exceeded.");
    this.name = "MarkdownMutationReadLimitError";
  }
}

const defaultOperations: MarkdownMutationOperations = {
  readFile,
  realpath,
  stat
};

/**
 * Serialize one mutation task by the target's resolved realpath.  The task
 * itself owns its read/check/write sequence; callers never observe a gap
 * between a check and another in-process writer for the same file.
 */
export async function runMarkdownFileMutation<T>(
  filePath: string,
  task: () => Promise<T>
): Promise<T> {
  const key = await mutationQueueKey(filePath);
  const previous = mutationQueues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  const settled = current.then(() => undefined, () => undefined);
  mutationQueues.set(key, settled);

  try {
    return await current;
  } finally {
    if (mutationQueues.get(key) === settled) {
      mutationQueues.delete(key);
    }
  }
}

export async function captureMarkdownMutationSnapshot(
  filePath: string,
  operations: Partial<MarkdownMutationOperations> = {}
): Promise<MarkdownMutationSnapshot> {
  const activeOperations = { ...defaultOperations, ...operations };
  const statsBeforeRead = await activeOperations.stat(filePath);
  if (!Number.isSafeInteger(statsBeforeRead.size) || statsBeforeRead.size < 0 || statsBeforeRead.size > maxMarkdownMutationReadBytes) {
    throw new MarkdownMutationReadLimitError();
  }
  const content = await activeOperations.readFile(filePath, "utf8");
  const actualBytes = Buffer.byteLength(content, "utf8");
  if (actualBytes > maxMarkdownMutationReadBytes) {
    throw new MarkdownMutationReadLimitError();
  }
  const statsAfterRead = await activeOperations.stat(filePath);
  if (!sameFileStats(statsBeforeRead, statsAfterRead)) {
    throw new MarkdownMutationConflictError();
  }

  return {
    content,
    token: tokenFor(content, statsAfterRead)
  };
}

export async function assertMarkdownMutationSnapshotCurrent(
  filePath: string,
  snapshot: MarkdownMutationSnapshot,
  operations: Partial<MarkdownMutationOperations> = {}
): Promise<void> {
  let current: MarkdownMutationSnapshot;
  try {
    current = await captureMarkdownMutationSnapshot(filePath, operations);
  } catch {
    throw new MarkdownMutationConflictError();
  }

  if (!sameToken(snapshot.token, current.token) || snapshot.content !== current.content) {
    throw new MarkdownMutationConflictError();
  }
}

export function isMarkdownMutationConflict(error: unknown): error is MarkdownMutationConflictError {
  return error instanceof MarkdownMutationConflictError;
}

async function mutationQueueKey(filePath: string): Promise<string> {
  try {
    return await defaultOperations.realpath(filePath);
  } catch {
    // A disappearing file is handled by the task's normal error/competition
    // path.  Keep a stable absolute key so two requests still serialize while
    // that failure is being resolved.
    return path.resolve(filePath);
  }
}

function tokenFor(
  content: string,
  fileStats: Pick<Stats, "dev" | "ino" | "mtimeMs" | "size">
): MarkdownMutationToken {
  return {
    contentHash: createHash("sha256").update(content).digest("hex"),
    dev: fileStats.dev,
    ino: fileStats.ino,
    mtimeMs: fileStats.mtimeMs,
    size: fileStats.size
  };
}

function sameToken(left: MarkdownMutationToken, right: MarkdownMutationToken): boolean {
  return left.contentHash === right.contentHash &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mtimeMs === right.mtimeMs &&
    left.size === right.size;
}

function sameFileStats(
  left: Pick<Stats, "dev" | "ino" | "mtimeMs" | "size">,
  right: Pick<Stats, "dev" | "ino" | "mtimeMs" | "size">
): boolean {
  return left.dev === right.dev && left.ino === right.ino &&
    left.mtimeMs === right.mtimeMs && left.size === right.size;
}
