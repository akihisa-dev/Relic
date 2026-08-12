# Tauri 2 spike decision matrix

| Contract | Status | Evidence in this spike | Gate to advance |
| --- | --- | --- | --- |
| Renderer reuse and API protocol v7 | partial | `src/main.tsx`, `src/tauriRelicClient.ts`, adapter verifier | Prove every production renderer operation has a typed Tauri implementation; unsupported operations remain migration blockers. |
| Workspace boundary and symlink safety | blocking | validation tests cover absolute, `..`, NUL, hidden/non-normalized paths and external symlink parents | Prove read/write canonicalization cannot be swapped between check and open (openat/fd-relative or equivalent) on every target OS. |
| Markdown atomic save | blocking | temp-file + `sync_all` + rename; success, conflict, failure-side-effect, and parent-sync paths are tested | Add descriptor-relative locking/replace that closes external-write TOCTOU; prove directory fsync failure handling on every target filesystem. |
| File watcher generation and cleanup | partial | recursive snapshot, relative changed paths, bounded retry, status/recovery rescan, and generation invalidation tests | Inject runtime failures and prove cleanup/recovery under real watcher backends and large trees. |
| Folder dialog and workspace persistence | partial | workspace path command is isolated; adapter returns explicit unsupported for `openWorkspace` | Prove native folder dialog, persisted scope, and cancel/error semantics. |
| PDF output | blocking | `output_save_preview_as_pdf` and adapter return `TAURI_SPIKE_UNSUPPORTED` | Demonstrate a sandboxed, CSP-compatible equivalent to Electron `printToPDF`, including Mermaid/D2 and attachments. |
| Drag-out, trash, and menu/window lifecycle | blocking | adapter exposes explicit unsupported/no-op boundaries | Prove each native contract with security and failure-path tests. |
| Capability/CSP isolation | partial | `capabilities/default.json`, strict `tauri.conf.json` CSP, no shell/fs broad permissions | Review generated permissions and CSP in a successfully packaged artifact. |
| macOS `.app`/`.dmg` packaging | partial | isolated identifier and `bundle.active=true`; debug bundle is a separate gate | Build and inspect a debug artifact without launching it; signing/notarization remains release work. |
| License and SBOM | partial | `Cargo.lock` and `pnpm-lock.yaml` are committed and dependency versions are pinned | Generate and archive Cargo/npm SBOM plus license report in CI before adoption. |

The matrix is intentionally conservative: an unverified or unknown native contract is not treated as equivalent to the Electron behavior.
