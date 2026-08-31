import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { listPackage, statFile } from "@electron/asar";

const requiredAsarEntries = [
  "/package.json",
  "/.vite/build/main.js",
  "/.vite/build/preload.js",
  "/.vite/renderer/main_window/index.html",
  "/assets/icon.iconset/icon_32x32.png"
];

const electronRuntimeResourceEntries = [
  "af.lproj",
  "am.lproj",
  "ar.lproj",
  "bg.lproj",
  "bn.lproj",
  "ca.lproj",
  "cs.lproj",
  "da.lproj",
  "de.lproj",
  "el.lproj",
  "electron.icns",
  "en.lproj",
  "en_GB.lproj",
  "es.lproj",
  "es_419.lproj",
  "et.lproj",
  "fa.lproj",
  "fi.lproj",
  "fil.lproj",
  "fr.lproj",
  "gu.lproj",
  "he.lproj",
  "hi.lproj",
  "hr.lproj",
  "hu.lproj",
  "id.lproj",
  "it.lproj",
  "ja.lproj",
  "kn.lproj",
  "ko.lproj",
  "lt.lproj",
  "lv.lproj",
  "ml.lproj",
  "mr.lproj",
  "ms.lproj",
  "nb.lproj",
  "nl.lproj",
  "pl.lproj",
  "pt_BR.lproj",
  "pt_PT.lproj",
  "ro.lproj",
  "ru.lproj",
  "sk.lproj",
  "sl.lproj",
  "sr.lproj",
  "sv.lproj",
  "sw.lproj",
  "ta.lproj",
  "te.lproj",
  "th.lproj",
  "tr.lproj",
  "uk.lproj",
  "ur.lproj",
  "vi.lproj",
  "zh_CN.lproj",
  "zh_TW.lproj"
];

export const requiredPackagedResourceEntries = [
  "/app.asar",
  "/LICENSE",
  "/THIRD_PARTY_NOTICES.md",
  "/sbom",
  "/sbom/relic-dependencies.cdx.json",
  ...electronRuntimeResourceEntries.map((entry) => `/${entry}`)
];

export function auditAsarEntries(entries) {
  const normalizedEntries = entries.map(normalizeAsarEntry);
  const entrySet = new Set(normalizedEntries);
  const missing = requiredAsarEntries.filter((entry) => !entrySet.has(entry));
  const forbidden = normalizedEntries.filter((entry) => isForbiddenAsarEntry(entry));
  const hasRendererAssets = normalizedEntries.some((entry) => entry.startsWith("/.vite/renderer/main_window/assets/"));
  if (!hasRendererAssets) missing.push("/.vite/renderer/main_window/assets/*");
  return { forbidden, missing };
}

export function normalizeAsarEntry(entry) {
  return entry.startsWith("/") ? entry : `/${entry}`;
}

export function isForbiddenAsarEntry(entry) {
  if (entry.endsWith(".map")) return true;
  if ([
    "/",
    "/.vite",
    "/.vite/build",
    "/.vite/renderer",
    "/.vite/renderer/main_window",
    "/.vite/renderer/main_window/assets",
    "/assets",
    "/assets/icon.iconset",
    "/package.json",
    "/.vite/build/main.js",
    "/.vite/build/preload.js",
    "/assets/icon.iconset/icon_32x32.png"
  ].includes(entry)) return false;
  return !entry.startsWith("/.vite/renderer/main_window/");
}

export function auditPackagedResourceEntries(entries) {
  const normalizedEntries = entries.map(normalizeAsarEntry);
  const entrySet = new Set(normalizedEntries);
  const allowedEntries = new Set(requiredPackagedResourceEntries);
  return {
    missing: requiredPackagedResourceEntries.filter((entry) => !entrySet.has(entry)),
    unexpected: normalizedEntries.filter((entry) => !allowedEntries.has(entry))
  };
}

export async function listPackagedResourceEntries(resourcesDirectory) {
  const entries = [];

  async function visit(directory, relativeDirectory = "") {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const relativePath = path.posix.join(relativeDirectory, child.name);
      entries.push(`/${relativePath}`);
      if (child.isDirectory()) {
        await visit(path.join(directory, child.name), relativePath);
      }
    }
  }

  await visit(resourcesDirectory);
  return entries;
}

export async function inspectPackagedResources(resourcesDirectory) {
  const appAsarPath = path.join(resourcesDirectory, "app.asar");
  const legalPaths = [
    path.join(resourcesDirectory, "LICENSE"),
    path.join(resourcesDirectory, "THIRD_PARTY_NOTICES.md"),
    path.join(resourcesDirectory, "sbom", "relic-dependencies.cdx.json")
  ];
  const resourceAudit = auditPackagedResourceEntries(
    await listPackagedResourceEntries(resourcesDirectory)
  );
  if (resourceAudit.missing.length > 0 || resourceAudit.unexpected.length > 0) {
    const details = [
      ...resourceAudit.missing.map((entry) => `Missing packaged resource: ${entry}`),
      ...resourceAudit.unexpected.map((entry) => `Unexpected packaged resource: ${entry}`)
    ];
    throw new Error(details.join("\n"));
  }

  const asarEntries = listPackage(appAsarPath);
  const audit = auditAsarEntries(asarEntries);
  if (audit.missing.length > 0 || audit.forbidden.length > 0) {
    const details = [
      ...audit.missing.map((entry) => `Missing package entry: ${entry}`),
      ...audit.forbidden.map((entry) => `Forbidden package entry: ${entry}`)
    ];
    throw new Error(details.join("\n"));
  }

  let asarFileCount = 0;
  for (const entry of asarEntries) {
    const info = statFile(appAsarPath, entry.slice(1), false);
    if (!("files" in info)) asarFileCount += 1;
  }

  const legalFiles = [];
  for (const legalPath of legalPaths) {
    const fileStats = await stat(legalPath);
    legalFiles.push({ bytes: fileStats.size, path: path.relative(resourcesDirectory, legalPath) });
  }
  const asarStats = await stat(appAsarPath);
  return {
    appOwnedBytes: asarStats.size + legalFiles.reduce((sum, file) => sum + file.bytes, 0),
    appOwnedFileCount: asarFileCount + legalFiles.length,
    asarBytes: asarStats.size,
    asarFileCount,
    legalFiles
  };
}

export function renderPackageContentReport(report) {
  return [
    "Packaged app-owned resources (Electron runtime excluded)",
    `bytes\t${report.appOwnedBytes}`,
    `files\t${report.appOwnedFileCount}`,
    `app.asar bytes\t${report.asarBytes}`,
    `app.asar files\t${report.asarFileCount}`,
    ...report.legalFiles.map((file) => `${file.path}\t${file.bytes}`)
  ].join("\n");
}

async function findResourcesDirectory(packageDirectory) {
  const direct = path.join(packageDirectory, "resources");
  try {
    await access(direct);
    return direct;
  } catch {
    const entries = await readdir(packageDirectory, { withFileTypes: true });
    const app = entries.find((entry) => entry.isDirectory() && entry.name.endsWith(".app"));
    if (!app) throw new Error(`Packaged resources directory was not found: ${packageDirectory}`);
    return path.join(packageDirectory, app.name, "Contents", "Resources");
  }
}

async function main() {
  const packageDirectory = process.argv[2];
  if (!packageDirectory) throw new Error("Usage: node scripts/package-content-report.mjs <packaged-app-directory>");
  const resourcesDirectory = await findResourcesDirectory(path.resolve(packageDirectory));
  console.log(renderPackageContentReport(await inspectPackagedResources(resourcesDirectory)));
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
