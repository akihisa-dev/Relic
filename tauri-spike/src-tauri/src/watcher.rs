use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread::{self, JoinHandle};
use std::time::{Duration, SystemTime};

use tauri::{AppHandle, Emitter};

pub struct WatcherHandle {
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

pub const MAX_RETRY_DELAY: Duration = Duration::from_secs(8);

pub fn retry_delay(attempt: u32) -> Duration {
    let seconds = 1u64 << attempt.min(3);
    Duration::from_secs(seconds.min(MAX_RETRY_DELAY.as_secs()))
}

#[derive(Default)]
pub struct GenerationGate(std::sync::atomic::AtomicU64);

impl GenerationGate {
    pub fn next(&self) -> u64 {
        self.0.fetch_add(1, Ordering::SeqCst) + 1
    }

    pub fn is_current(&self, generation: u64) -> bool {
        self.0.load(Ordering::SeqCst) == generation
    }
}

impl Drop for WatcherHandle {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

pub fn replace_watcher(
    app: &AppHandle,
    current: &mut Option<WatcherHandle>,
    workspace: PathBuf,
    generations: Arc<GenerationGate>,
    workspace_id: String,
) {
    current.take();
    let stop = Arc::new(AtomicBool::new(false));
    let thread_stop = Arc::clone(&stop);
    let generation = generations.next();
    let app = app.clone();
    let handle = thread::spawn(move || {
        let initial = snapshot_tree(&workspace);
        let mut previous = initial.clone().unwrap_or_default();
        let mut retry_attempt: u32 = 0;
        let mut had_error = initial.is_err();
        while !thread_stop.load(Ordering::SeqCst) {
            if !generations.is_current(generation) {
                break;
            }
            if !interruptible_sleep(&thread_stop, Duration::from_millis(500)) {
                break;
            }
            match snapshot_tree(&workspace) {
                Ok(next) => {
                    if had_error {
                        let _ = app.emit(
                            "workspace_changed",
                            serde_json::json!({
                                "workspaceId": workspace_id.clone(), "changedAt": chrono_like_now()
                            }),
                        );
                        let _ = app.emit("workspace_watch_status", serde_json::json!({
                            "workspaceId": workspace_id.clone(), "status": "recovered", "rescan": "full", "changedAt": chrono_like_now()
                        }));
                        had_error = false;
                    }
                    retry_attempt = 0;
                    if next != previous {
                        previous = next;
                        let _ = app.emit(
                            "workspace_changed",
                            serde_json::json!({
                                "workspaceId": workspace_id.clone(),
                                "status": "changed",
                                "changedAt": chrono_like_now()
                            }),
                        );
                    }
                }
                Err(_) => {
                    retry_attempt = retry_attempt.saturating_add(1);
                    had_error = true;
                    let _ = app.emit(
                        "workspace_watch_status",
                        serde_json::json!({
                            "workspaceId": workspace_id.clone(),
                            "status": "error",
                            "retryAttempt": retry_attempt,
                            "changedAt": chrono_like_now(),
                        }),
                    );
                    if !interruptible_sleep(&thread_stop, retry_delay(retry_attempt)) {
                        break;
                    }
                }
            }
        }
    });
    *current = Some(WatcherHandle {
        stop,
        handle: Some(handle),
    });
}

fn interruptible_sleep(stop: &AtomicBool, duration: Duration) -> bool {
    let deadline = std::time::Instant::now() + duration;
    while !stop.load(Ordering::SeqCst) {
        let remaining = deadline.saturating_duration_since(std::time::Instant::now());
        if remaining.is_zero() {
            return true;
        }
        thread::sleep(remaining.min(Duration::from_millis(25)));
    }
    false
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct Fingerprint {
    modified: SystemTime,
    size: u64,
}
type Snapshot = std::collections::BTreeMap<String, Fingerprint>;

fn snapshot_tree(path: &PathBuf) -> Result<Snapshot, String> {
    fn visit(root: &PathBuf, current: &std::path::Path, out: &mut Snapshot) -> Result<(), String> {
        for entry in std::fs::read_dir(current).map_err(|_| "watcher rescan failed".to_string())? {
            let entry = entry.map_err(|_| "watcher rescan failed".to_string())?;
            let file_type = entry
                .file_type()
                .map_err(|_| "watcher rescan failed".to_string())?;
            if file_type.is_symlink() {
                continue;
            }
            let path = entry.path();
            let relative = path
                .strip_prefix(root)
                .map_err(|_| "watcher path failed".to_string())?;
            let key = relative.to_string_lossy().to_string();
            let metadata = entry
                .metadata()
                .map_err(|_| "watcher rescan failed".to_string())?;
            if metadata.is_dir() {
                visit(root, &path, out)?;
            } else if metadata.is_file() {
                out.insert(
                    key,
                    Fingerprint {
                        modified: metadata
                            .modified()
                            .map_err(|_| "watcher rescan failed".to_string())?,
                        size: metadata.len(),
                    },
                );
            }
        }
        Ok(())
    }
    let mut out = Snapshot::new();
    visit(path, path, &mut out)?;
    Ok(out)
}

fn chrono_like_now() -> String {
    format!("{:?}", SystemTime::now())
}

#[allow(dead_code)]
pub fn stop_watcher(current: &Mutex<Option<WatcherHandle>>) {
    if let Ok(mut guard) = current.lock() {
        guard.take();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retry_is_bounded_and_generation_invalidates_old_work() {
        assert_eq!(retry_delay(0), Duration::from_secs(1));
        assert_eq!(retry_delay(3), MAX_RETRY_DELAY);
        assert_eq!(retry_delay(99), MAX_RETRY_DELAY);
        let gate = GenerationGate::default();
        let first = gate.next();
        assert!(gate.is_current(first));
        let second = gate.next();
        assert!(!gate.is_current(first));
        assert!(gate.is_current(second));
    }

    #[test]
    fn recursive_snapshot_reports_nested_changes_and_relative_paths() {
        let root = std::env::temp_dir().join(format!("relic-tauri-watch-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join("nested")).unwrap();
        std::fs::write(root.join("nested/note.md"), "one").unwrap();
        let first = snapshot_tree(&root).unwrap();
        std::fs::write(root.join("nested/note.md"), "two").unwrap();
        let second = snapshot_tree(&root).unwrap();
        assert_ne!(first, second);
        assert!(!first.keys().any(|path| path.starts_with('/')));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn interruptible_sleep_stops_within_reasonable_bound() {
        let stop = AtomicBool::new(true);
        let started = std::time::Instant::now();
        assert!(!interruptible_sleep(&stop, Duration::from_secs(8)));
        assert!(started.elapsed() < Duration::from_millis(100));
    }
}
