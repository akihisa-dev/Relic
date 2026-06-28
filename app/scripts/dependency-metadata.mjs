import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const appDir = fileURLToPath(new URL("..", import.meta.url));
export const repositoryRoot = path.resolve(appDir, "..");

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function productionDependencies() {
  const packageJson = await readJson(path.join(appDir, "package.json"));
  const dependencyNames = Object.keys(packageJson.dependencies ?? {}).sort((a, b) => a.localeCompare(b));

  return Promise.all(dependencyNames.map(async (name) => {
    const metadata = await readPackageMetadata(name);

    return {
      declaredRange: packageJson.dependencies[name],
      license: licenseText(metadata.license),
      name,
      repository: repositoryUrl(metadata.repository),
      version: metadata.version ?? "unknown"
    };
  }));
}

async function readPackageMetadata(name) {
  return readJson(path.join(appDir, "node_modules", ...name.split("/"), "package.json"));
}

function licenseText(license) {
  if (typeof license === "string" && license.trim()) return license.trim();
  if (Array.isArray(license)) {
    return license.map(licenseText).filter(Boolean).join(" OR ") || "UNKNOWN";
  }
  if (license && typeof license === "object" && typeof license.type === "string") {
    return license.type.trim() || "UNKNOWN";
  }

  return "UNKNOWN";
}

function repositoryUrl(repository) {
  if (typeof repository === "string") return normalizeGitUrl(repository);
  if (repository && typeof repository === "object" && typeof repository.url === "string") {
    return normalizeGitUrl(repository.url);
  }

  return "";
}

function normalizeGitUrl(url) {
  const normalized = url
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/\.git$/, "");

  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalized)) {
    return `https://github.com/${normalized}`;
  }

  return normalized;
}
