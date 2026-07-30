export const nodeTestIncludes = [
  "build-tools/**/*.{test,spec}.ts",
  "scripts/**/*.{test,spec}.mjs",
  "src/main/**/*.{test,spec}.{ts,tsx}",
  "src/preload/**/*.{test,spec}.{ts,tsx}",
  "src/shared/**/*.{test,spec}.{ts,tsx}"
];

export const rendererTestIncludes = ["src/renderer/**/*.{test,spec}.{ts,tsx}"];

const testFilePattern = /\.(?:test|spec)\.(mjs|ts|tsx)$/u;

export function vitestProjectForTestPath(relativePath) {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  const match = normalizedPath.match(testFilePattern);
  if (!match) return null;

  const extension = match[1];
  if (normalizedPath.startsWith("src/renderer/") && extension !== "mjs") return "renderer";
  if (normalizedPath.startsWith("build-tools/") && extension === "ts") return "node";
  if (normalizedPath.startsWith("scripts/") && extension === "mjs") return "node";
  if (/^src\/(?:main|preload|shared)\//u.test(normalizedPath) && extension !== "mjs") return "node";
  return null;
}
