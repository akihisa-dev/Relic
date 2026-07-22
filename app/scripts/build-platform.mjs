import { rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertAppleSiliconHost, macBuildTarget } from './mac-build-target.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, '..');

if (process.argv.length !== 2) {
  console.error('[build:platform] usage: node scripts/build-platform.mjs');
  process.exit(1);
}

try {
  assertAppleSiliconHost();
} catch (error) {
  console.error(`[build:platform] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const runNodeScript = (scriptName, args) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [path.join('scripts', scriptName), ...args], {
    cwd: appDir,
    stdio: 'inherit'
  });

  child.on('error', reject);
  child.on('exit', (code, signal) => {
    if (signal) {
      reject(new Error(`${scriptName} terminated by signal ${signal}`));
      return;
    }

    if (code === 0) {
      resolve();
      return;
    }

    reject(new Error(`${scriptName} exited with code ${code ?? 1}`));
  });
});

const outputDir = path.join(appDir, macBuildTarget.outputDirectory);
await rm(outputDir, { force: true, recursive: true });
console.log(`[build:platform] removed ${outputDir}`);

await runNodeScript('run-forge-build.mjs', ['make']);
await runNodeScript('check-package-artifacts.mjs', []);
