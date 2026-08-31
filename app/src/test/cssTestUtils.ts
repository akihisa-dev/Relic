import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function readCssEntry(filePath: string, importStack = new Set<string>()): string {
  const absolutePath = resolve(filePath);
  if (importStack.has(absolutePath)) {
    throw new Error(`Circular CSS test import: ${absolutePath}`);
  }

  const nextImportStack = new Set(importStack).add(absolutePath);
  const source = readFileSync(absolutePath, "utf8");
  return source.replace(/@import\s+["']([^"']+)["'];/g, (_match, importPath: string) =>
    readCssEntry(resolve(dirname(absolutePath), importPath), nextImportStack)
  );
}
