import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectPackagedResources, renderPackageContentReport } from './package-content-report.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const platform = process.argv[2];
const outDir = path.resolve(__dirname, '..', 'out', platform ?? '');

const forbidden = [/setup.*\.exe$/i, /^update\.exe$/i, /\.nupkg$/i, /^releases$/i];

if (platform !== 'darwin' && platform !== 'win32') {
  console.error('[check:package:safe] usage: node scripts/check-package-artifacts.mjs <darwin|win32>');
  process.exit(1);
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(resolved));
      continue;
    }

    files.push(resolved);
  }

  return files;
}

async function findPackagedAppDir() {
  const entries = await readdir(outDir, { withFileTypes: true });
  const prefix = platform === 'darwin' ? 'Relic-darwin-' : 'Relic-win32-';
  const match = entries.find((entry) => entry.isDirectory() && entry.name.startsWith(prefix));

  if (!match) {
    throw new Error(`packaged app directory not found for ${platform}`);
  }

  return path.join(outDir, match.name);
}

async function checkNoInstallerArtifacts() {
  const files = await walk(outDir);
  const offenders = files.filter((filePath) => {
    const name = path.basename(filePath);
    return forbidden.some((pattern) => pattern.test(name));
  });

  if (offenders.length > 0) {
    console.error('[check:package:safe] forbidden artifacts found:');
    offenders.forEach((entry) => console.error(` - ${path.relative(outDir, entry)}`));
    process.exit(1);
  }
}

async function checkMacApp(appDir) {
  const appBundlePath = path.join(appDir, 'Relic.app');
  await access(path.join(appBundlePath, 'Contents', 'MacOS', 'Relic'));
  await access(path.join(appBundlePath, 'Contents', 'Resources', 'app.asar'));
  const report = await inspectPackagedResources(path.join(appBundlePath, 'Contents', 'Resources'));
  console.log(renderPackageContentReport(report));
  console.log(`[check:mac:safe] OK: unpacked app verified at ${appDir}`);
  console.log('[check:mac:safe] OK: Relic.app exists');
}

async function checkWindowsApp(appDir) {
  await access(path.join(appDir, 'Relic.exe'));
  await access(path.join(appDir, 'resources', 'app.asar'));
  const report = await inspectPackagedResources(path.join(appDir, 'resources'));
  console.log(renderPackageContentReport(report));
  console.log(`[check:win:safe] OK: unpacked app verified at ${appDir}`);
  console.log('[check:win:safe] OK: Relic.exe exists');
}

await checkNoInstallerArtifacts();

const packagedAppDir = await findPackagedAppDir();

if (platform === 'darwin') {
  await checkMacApp(packagedAppDir);
} else {
  await checkWindowsApp(packagedAppDir);
}

console.log('[check:package:safe] OK: no Setup.exe / Update.exe / .nupkg / RELEASES found');
