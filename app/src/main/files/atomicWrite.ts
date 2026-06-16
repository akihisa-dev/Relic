import { open, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

interface AtomicWriteOperations {
  rename: (oldPath: string, newPath: string) => Promise<void>;
  unlink: (filePath: string) => Promise<void>;
  writeFile: (
    filePath: string,
    content: string | Uint8Array,
    encoding?: BufferEncoding
  ) => Promise<void>;
}

const defaultOperations: AtomicWriteOperations = {
  rename,
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

export async function atomicWriteTextFile(
  filePath: string,
  content: string,
  operations: AtomicWriteOperations = defaultOperations
): Promise<void> {
  await atomicWriteFile(filePath, content, "utf8", operations);
}

export async function atomicWriteFile(
  filePath: string,
  content: string | Uint8Array,
  encoding?: BufferEncoding,
  operations: AtomicWriteOperations = defaultOperations
): Promise<void> {
  const temporaryPath = createTemporaryPath(filePath);

  try {
    await operations.writeFile(temporaryPath, content, encoding);
    await operations.rename(temporaryPath, filePath);
  } catch (error) {
    await operations.unlink(temporaryPath).catch(() => undefined);
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
