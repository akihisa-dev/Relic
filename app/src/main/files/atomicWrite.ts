import { rename, unlink, writeFile } from "node:fs/promises";
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
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  );

  try {
    await operations.writeFile(temporaryPath, content, encoding);
    await operations.rename(temporaryPath, filePath);
  } catch (error) {
    await operations.unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}
