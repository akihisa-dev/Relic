import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const rustSource = await readFile(path.join(root, "src-tauri/src/lib.rs"), "utf8");
const clientSource = await readFile(path.join(root, "src/tauriRelicClient.ts"), "utf8");
const config = await readFile(path.join(root, "src-tauri/tauri.conf.json"), "utf8");
const matrix = await readFile(path.join(root, "DECISION_MATRIX.md"), "utf8");

const adapterTest = spawnSync(process.execPath, [path.join(root, "scripts/adapter-contract.test.mjs")], { encoding: "utf8" });
const toolchain = spawnSync("sh", ["-lc", "TOOLCHAIN_BIN=$(rustup which rustc | sed 's#/rustc$##'); PATH=\"$TOOLCHAIN_BIN:$PATH\" cargo test --manifest-path src-tauri/Cargo.toml"], { cwd: root, encoding: "utf8", timeout: 120000 });
const rustTestsPassed = toolchain.status === 0;
const cargoCheck = spawnSync("sh", ["-lc", "TOOLCHAIN_BIN=$(rustup which rustc | sed 's#/rustc$##'); PATH=\"$TOOLCHAIN_BIN:$PATH\" cargo check --manifest-path src-tauri/Cargo.toml"], { cwd: root, encoding: "utf8", timeout: 120000 });
const tsCheck = spawnSync("pnpm", ["exec", "tsc", "--noEmit", "--pretty", "false"], { cwd: root, encoding: "utf8", timeout: 120000 });
const frontendBuild = spawnSync("pnpm", ["exec", "vite", "build", "--config", "vite.config.ts"], { cwd: root, encoding: "utf8", timeout: 120000 });

const checks = [
  ["pdf is explicitly unsupported", /TAURI_SPIKE_UNSUPPORTED[\s\S]*PDF output is intentionally unsupported/u.test(rustSource)],
  ["frontend preserves unsupported result", /savePreviewAsPdf[\s\S]*unsupported\("savePreviewAsPdf"\)/u.test(clientSource)],
  ["bundle identifier is isolated", /app\.relic\.desktop\.tauri-spike/u.test(config)],
  ["bundle identifier is isolated from Electron", /app\.relic\.desktop\.tauri-spike/u.test(config)],
  ["bundle generation is explicit for later debug inspection", /"active"\s*:\s*true/u.test(config)],
  ["strict CSP is configured", /default-src 'self'[\s\S]*object-src 'none'/u.test(config)],
  ["event listeners retain an unlisten cleanup", /listen<[\s\S]*then\(\(stop\)[\s\S]*unlisten = stop/u.test(clientSource)],
  ["PDF unsupported result is not silent", /TAURI_SPIKE_UNSUPPORTED/u.test(clientSource)],
  ["RelicApi protocol version is retained", /apiContractVersion:\s*7/u.test(clientSource)],
  ["decision matrix records blocking and partial gates", /\| blocking \|/u.test(matrix) && /\| partial \|/u.test(matrix)],
  ["Rust safety tests execute successfully", rustTestsPassed],
  ["Rust cargo check executes successfully", cargoCheck.status === 0],
  ["adapter contract tests execute successfully", adapterTest.status === 0],
  ["frontend direct typecheck executes successfully", tsCheck.status === 0],
  ["frontend production build executes successfully", frontendBuild.status === 0],
  ["package manifest pins Tauri versions", /@tauri-apps\/api.*2\.11\.1/u.test(await readFile(path.join(root, "package.json"), "utf8"))],
  ["bundle evidence is explicit or remains a missing gate", /bundle generation is enabled[\s\S]*debug artifact/u.test(await readFile(path.join(root, "DECISION.md"), "utf8"))],
  ["security gate is not falsely supported", /\| Workspace boundary and symlink safety \| blocking \|/u.test(matrix)],
  ["atomic TOCTOU gate is not falsely supported", /\| Markdown atomic save \| blocking \|/u.test(matrix)]
];

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name);
if (failures.length > 0) {
  console.error(`Tauri spike decision verification failed (missing gates are release-blocking):\n${failures.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Tauri spike decision verification passed: ${rustTestsPassed ? "Rust tests" : "Rust tests missing"}, ${adapterTest.status === 0 ? "adapter tests" : "adapter tests missing"}; bundle evidence=${existsSync(path.join(root, "src-tauri/target/debug/bundle/macos")) ? "present" : "missing gate"}.`);
}
