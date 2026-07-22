import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, '..');

const [command, platform, arch] = process.argv.slice(2);

const supportedCommands = new Set(['make', 'package']);

if (!supportedCommands.has(command) || platform !== 'darwin') {
  console.error('[run:forge] usage: node scripts/run-forge-build.mjs <make|package> darwin [arch]');
  process.exit(1);
}

const forgeArgs = ['exec', 'electron-forge', command, '--platform', platform];

if (arch) {
  forgeArgs.push('--arch', arch);
}

const pnpmCommand = 'pnpm';
const forgeEnvironment = {
  ...process.env,
  RELIC_FORGE_OUT_DIR: 'out/darwin'
};

if (process.platform === 'darwin' && platform === 'darwin' && Number.parseInt(process.versions.node, 10) >= 25) {
  const extractorPath = path.join(__dirname, 'forge-electron-extract.cjs');
  forgeEnvironment.RELIC_ELECTRON_EXTRACTOR = 'ditto';
  forgeEnvironment.NODE_OPTIONS = [
    process.env.NODE_OPTIONS,
    `--require=${extractorPath}`
  ].filter(Boolean).join(' ');
}

const spawnOptions = {
  cwd: appDir,
  env: forgeEnvironment,
  shell: false,
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
