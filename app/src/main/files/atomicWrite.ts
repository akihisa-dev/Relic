import { open, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

interface AtomicWriteOperations {
  rename: (oldPath: string, newPath: string) => Promise<void>;
  stat?: (filePath: string) => Promise<{ mode: number }>;
  unlink: (filePath: string) => Promise<void>;
  writeFile: (
    filePath: string,
    content: string | Uint8Array,
    options?: BufferEncoding | { encoding?: BufferEncoding; mode?: number }
  ) => Promise<void>;
}

interface AtomicWriteOptions {
  mode?: number;
}

const atomicWriteTemporaryFileNamePattern = /^\..*\.\d+\.\d+\.[a-z0-9]+\.tmp$/;

const defaultOperations: AtomicWriteOperations = {
  rename,
  stat,
  unlink,
  writeFile
};

interface AtomicNewFileHandle {
  close: () => Promise<void>;
  writeFile: (content: string, encoding: BufferEncoding) => Promise<void>;
}

interface AtomicCreateOperations {
  open: (filePath: string, flags: "wx") => Promise<AtomicNewFileHandle>;
  unlink: (filePath: string) => Promise<void>;
}

const defaultCreateOperations: AtomicCreateOperations = {
  open,
  unlink
};

export function isAtomicWriteTemporaryPath(filePath: string): boolean {
  return atomicWriteTemporaryFileNamePattern.test(path.basename(filePath));
}

export async function atomicWriteTextFile(
  filePath: string,
  content: string,
  operations: AtomicWriteOperations = defaultOperations,
  options: AtomicWriteOptions = {}
): Promise<void> {
  await atomicWriteFile(filePath, content, "utf8", operations, options);
}

export async function atomicWriteFile(
  filePath: string,
  content: string | Uint8Array,
  encoding?: BufferEncoding,
  operations: AtomicWriteOperations = defaultOperations,
  options: AtomicWriteOptions = {}
): Promise<void> {
  const temporaryPath = createTemporaryPath(filePath);

  try {
    const mode = options.mode ?? await existingFileMode(filePath, operations);
    await operations.writeFile(temporaryPath, content, mode === undefined ? encoding : { encoding, mode });
    await operations.rename(temporaryPath, filePath);
  } catch (error) {
    await operations.unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function existingFileMode(filePath: string, operations: AtomicWriteOperations): Promise<number | undefined> {
  try {
    const existing = await (operations.stat ?? stat)(filePath);
    return existing.mode & 0o7777;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export async function atomicWriteNewTextFile(
  filePath: string,
  content: string,
  operations: AtomicCreateOperations = defaultCreateOperations
): Promise<void> {
  let handle: AtomicNewFileHandle | null = null;
  let created = false;

  try {
    handle = await operations.open(filePath, "wx");
    created = true;
    await handle.writeFile(content, "utf8");
    await handle.close();
    handle = null;
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (created) {
      await operations.unlink(filePath).catch(() => undefined);
    }
    throw error;
  }
}

function createTemporaryPath(filePath: string): string {
  return path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  );
}
