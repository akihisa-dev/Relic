import path from "node:path";

export function hasCurrentFileReference(message: string): boolean {
  return /(このファイル|現在のファイル|開いているファイル|今のファイル)/.test(message);
}

export function operationPathCandidates(operationPath: string): string[] {
  const normalizedPath = operationPath.replace(/\\/g, "/");
  const fileName = path.posix.basename(normalizedPath);
  const extension = path.posix.extname(fileName);
  const stem = extension ? fileName.slice(0, -extension.length) : fileName;

  return [normalizedPath, fileName, stem];
}

export function normalizeOperationText(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/[「」『』（）()[\]{}"'`、。，．\s]/g, "")
    .toLowerCase();
}
