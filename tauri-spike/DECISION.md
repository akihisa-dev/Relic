# Tauri 2 spike decision gates

This directory is an isolated feasibility spike. The Electron implementation under `app/` remains the product path and is not replaced by this directory.

## Final decision: migration not approved

This spike does not establish a safe Tauri replacement. Migration is blocked by the unproven check/open symlink-swap race, external-writer TOCTOU during expected-content saves, incomplete native workspace/dialog and lifecycle contracts, missing PDF equivalence, and incomplete runtime watcher and packaging evidence. The code and tests below are retained as decision evidence only; they must not be presented as production readiness.

## Fixed gates

- The Tauri bundle identifier is `app.relic.desktop.tauri-spike`; bundle generation is enabled only for a later debug artifact check and is never used to replace the Electron release.
- The frontend keeps the existing renderer and `RelicApi` shape behind `tauriRelicClient`; unsupported operations return `TAURI_SPIKE_UNSUPPORTED` instead of silently changing behavior.
- Workspace paths are canonicalized before use. Relative file paths accept only normalized, non-hidden `.md` paths, reject absolute paths, `..`, NUL bytes, invalid UTF-8, and content over 5 MiB. A check/open symlink-swap race is not proven without descriptor-relative APIs, so this contract remains blocking.
- Markdown writes use a temporary file, `sync_all`, rename, and parent-directory sync with cleanup on every observed failure. `expectedContent` detects an external write before replacement, but closing the external-writer TOCTOU is not proven; this contract remains blocking.
- Watcher replacement stops and joins the previous generation, recursively snapshots relative files, reports bounded retry/error/recovered-full-rescan status, and emits only logical workspace IDs. Runtime backend failure injection remains a partial gate.
- PDF is intentionally unsupported in this spike. Electron's `webContents.printToPDF` path has no equivalent command proven here; migration cannot be approved until a native, sandboxed, CSP-compatible path is separately demonstrated.
- Dependency provenance is locked in `Cargo.lock` and `pnpm-lock.yaml`. Adoption requires a generated SBOM (Cargo and npm ecosystems) and license report in CI, with every transitive license reviewed against the repository's distribution policy before release packaging. This spike does not publish an SBOM or alter Electron's dependency set.

The release decision is recorded in [`DECISION_MATRIX.md`](DECISION_MATRIX.md). `blocking` means the corresponding Electron contract has no demonstrated Tauri implementation; `partial` means the harness is present but a runtime or artifact gate remains; `supported` means the contract has an isolated implementation and automated evidence.

## Verification

Run `pnpm typecheck`, `pnpm build`, `pnpm exec node scripts/verify-spike-decision.mjs`, and the Rust `cargo check`/`cargo test` commands from this directory. Do not launch the GUI as part of the normal spike verification.

## Decision reproduction

From a new clone, or after removing ignored dependencies and build outputs, run the following without starting the GUI:

```sh
cd tauri-spike
pnpm install --frozen-lockfile
pnpm verify:decision
```

The Rust stable toolchain must already be installed through `rustup`; the verifier uses the installed stable toolchain for `cargo check` and `cargo test`. `pnpm verify:decision` runs the Rust tests, adapter contract test, direct TypeScript check, Vite production build, and static decision gates. `node_modules/`, `dist/`, `src-tauri/target/`, and `src-tauri/gen/` are ignored generated outputs and may be removed before repeating the procedure. Do not run `pnpm dev`, `pnpm tauri dev`, or any other GUI-launching command during this evidence run.
