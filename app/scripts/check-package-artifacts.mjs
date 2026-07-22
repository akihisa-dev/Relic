import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectPackagedResources, renderPackageContentReport } from './package-content-report.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const platform = process.argv[2];
const outDir = path.resolve(__dirname, '..', 'out', platform ?? '');

if (platform !== 'darwin') {
  console.error('[check:package:safe] usage: node scripts/check-package-artifacts.mjs darwin');
  process.exit(1);
}

async function findPackagedAppDir() {
  const entries = await readdir(outDir, { withFileTypes: true });
  const match = entries.find((entry) => entry.isDirectory() && entry.name.startsWith('Relic-darwin-'));

  if (!match) {
    throw new Error(`packaged app directory not found for ${platform}`);
  }

  return path.join(outDir, match.name);
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

const packagedAppDir = await findPackagedAppDir();
await checkMacApp(packagedAppDir);
