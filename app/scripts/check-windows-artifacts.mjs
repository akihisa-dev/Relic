import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '..', 'out');
const winOutDir = path.join(outDir, 'Relic-win32-x64');
const relicExePath = path.join(winOutDir, 'Relic.exe');

const forbidden = [/setup.*\.exe$/i, /^update\.exe$/i, /\.nupkg$/i, /^releases$/i];

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

const files = await walk(outDir);
const offenders = files.filter((filePath) => {
  const name = path.basename(filePath);
  return forbidden.some((pattern) => pattern.test(name));
});

if (offenders.length > 0) {
  console.error('[check:win:safe] forbidden artifacts found:');
  offenders.forEach((entry) => console.error(` - ${path.relative(outDir, entry)}`));
  process.exit(1);
}

await access(relicExePath);

const packageMarkerPath = path.join(winOutDir, 'resources', 'app.asar');
await access(packageMarkerPath);

console.log(`[check:win:safe] OK: unpacked app verified at ${winOutDir}`);
console.log('[check:win:safe] OK: Relic.exe exists');
console.log('[check:win:safe] OK: no Setup.exe / Update.exe / .nupkg / RELEASES found');
