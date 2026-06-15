import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, '..');

const [command, platform, arch] = process.argv.slice(2);

const supportedCommands = new Set(['make', 'package']);
const outputDirs = new Map([
  ['darwin', 'out/darwin'],
  ['win32', 'out/win32']
]);

if (!supportedCommands.has(command) || !outputDirs.has(platform)) {
  console.error('[run:forge] usage: node scripts/run-forge-build.mjs <make|package> <darwin|win32> [arch]');
  process.exit(1);
}

const forgeArgs = ['exec', 'electron-forge', command, '--platform', platform];

if (arch) {
  forgeArgs.push('--arch', arch);
}

const pnpmCommand = 'pnpm';
const spawnOptions = {
  cwd: appDir,
  env: {
    ...process.env,
    RELIC_FORGE_OUT_DIR: outputDirs.get(platform)
  },
  shell: process.platform === 'win32',
  stdio: 'inherit'
};

let child;
try {
  child = spawn(pnpmCommand, forgeArgs, spawnOptions);
} catch (error) {
  console.error(`[run:forge] failed to start ${pnpmCommand}: ${error.message}`);
  process.exit(1);
}

child.on('error', (error) => {
  console.error(`[run:forge] failed to start ${pnpmCommand}: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[run:forge] terminated by signal ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});
