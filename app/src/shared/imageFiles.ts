export const supportedMarkdownImageExtensions = [
  ".avif",
  ".bmp",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp"
] as const;

const supportedMarkdownImageExtensionSet = new Set<string>(supportedMarkdownImageExtensions);

export function isSupportedMarkdownImagePath(filePath: string): boolean {
  const extension = filePath.match(/\.[^.\\/]+$/)?.[0].toLowerCase();
  return extension !== undefined && supportedMarkdownImageExtensionSet.has(extension);
}

export function markdownImageAltFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const fileName = normalized.split("/").at(-1) ?? normalized;
  const extension = fileName.match(/\.[^.]+$/)?.[0] ?? "";
  return extension ? fileName.slice(0, -extension.length) : fileName;
}
