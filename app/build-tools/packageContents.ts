import path from "node:path";

const exactPackagedFiles = new Set([
  "/assets/icon.iconset/icon_32x32.png",
  "/package.json"
]);

const traversableDirectories = new Set([
  "",
  "/.vite",
  "/.vite/build",
  "/.vite/renderer",
  "/.vite/renderer/main_window",
  "/assets",
  "/assets/icon.iconset"
]);

export function relicPackageExtraResources(appDirectory: string): string[] {
  const repositoryDirectory = path.dirname(path.resolve(appDirectory));
  return [
    path.join(repositoryDirectory, "LICENSE"),
    path.join(repositoryDirectory, "THIRD_PARTY_NOTICES.md"),
    path.join(repositoryDirectory, "sbom")
  ];
}

export function ignoreRelicPackagePath(filePath: string): boolean {
  const normalized = normalizePackagerPath(filePath);
  if (traversableDirectories.has(normalized) || exactPackagedFiles.has(normalized)) return false;
  if (normalized.endsWith(".map")) return true;
  if (normalized.startsWith("/.vite/renderer/main_window/")) return false;
  if (normalized === "/.vite/build/main.js" || normalized === "/.vite/build/preload.js") return false;
  return true;
}

export function normalizePackagerPath(filePath: string): string {
  if (filePath === "" || filePath === "/") return "";
  return filePath.startsWith("/") ? filePath : `/${filePath}`;
}
