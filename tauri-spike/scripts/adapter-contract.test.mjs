import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const source = await readFile(path.join(root, "src/tauriRelicClient.ts"), "utf8");
assert.match(source, /apiContractVersion:\s*7/u);
assert.match(source, /workspace_set_path/u);
assert.match(source, /switchWorkspace: \(\) => unsupported/u);
assert.match(source, /TAURI_SPIKE_UNSUPPORTED/u);
assert.match(source, /cancelled/u);
assert.match(source, /workspace_watch_status/u);
assert.match(source, /status: "unavailable"/u);
assert.doesNotMatch(source, /changedPaths/u);
console.log("adapter contract tests passed");
