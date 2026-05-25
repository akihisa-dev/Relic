import { rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

interface AtomicWriteOperations {
  rename: typeof rename;
  unlink: typeof unlink;
  writeFile: typeof writeFile;
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
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  );

  try {
    await operations.writeFile(temporaryPath, content, "utf8");
    await operations.rename(temporaryPath, filePath);
  } catch (error) {
    await operations.unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}
