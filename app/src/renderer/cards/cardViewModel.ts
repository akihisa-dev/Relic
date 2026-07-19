import { isSupportedMarkdownImagePath } from "../../shared/imageFiles";

export function resolveCardImagePath(sourcePath: string, imagePath: string | null): string | null {
  if (imagePath === null) return null;
  const normalizedImagePath = imagePath.trim().replace(/\\/g, "/");
  if (
    normalizedImagePath === "" ||
    normalizedImagePath.startsWith("/") ||
    normalizedImagePath.startsWith("//") ||
    normalizedImagePath.includes("\0") ||
    normalizedImagePath.includes("?") ||
    normalizedImagePath.includes("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(normalizedImagePath)
  ) {
    return null;
  }

  const sourceSegments = sourcePath.replace(/\\/g, "/").split("/").slice(0, -1);
  const resolvedSegments = [...sourceSegments];

  for (const segment of normalizedImagePath.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (resolvedSegments.length === 0) return null;
      resolvedSegments.pop();
      continue;
    }
    resolvedSegments.push(segment);
  }

  const resolvedPath = resolvedSegments.join("/");
  return isSupportedMarkdownImagePath(resolvedPath) ? resolvedPath : null;
}
