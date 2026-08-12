use std::path::PathBuf;
use std::sync::Mutex;

use serde_json::{json, Value};
use tauri::{AppHandle, State};

mod security;
mod watcher;

#[derive(Default)]
pub struct SpikeState {
    workspace: Mutex<Option<PathBuf>>,
    workspace_id: Mutex<Option<String>>,
    watcher: Mutex<Option<watcher::WatcherHandle>>,
    generations: std::sync::Arc<watcher::GenerationGate>,
    file_lock: Mutex<()>,
}

type SpikeResult = Result<Value, String>;

#[tauri::command]
fn workspace_get_state(state: State<'_, SpikeState>) -> SpikeResult {
    let workspace = state.workspace.lock().map_err(|_| "state lock failed")?;
    let id = state.workspace_id.lock().map_err(|_| "state lock failed")?;
    Ok(workspace_state_value(workspace.as_ref(), id.as_deref()))
}

#[tauri::command]
fn workspace_set_path(app: AppHandle, state: State<'_, SpikeState>, path: String) -> SpikeResult {
    let canonical = security::canonical_workspace(&path)?;
    let mut workspace = state.workspace.lock().map_err(|_| "state lock failed")?;
    *workspace = Some(canonical.clone());
    let logical_id = format!("workspace-{}", stable_workspace_id(&canonical));
    *state.workspace_id.lock().map_err(|_| "state lock failed")? = Some(logical_id);
    let mut watcher = state.watcher.lock().map_err(|_| "watcher lock failed")?;
    watcher::replace_watcher(
        &app,
        &mut watcher,
        canonical,
        std::sync::Arc::clone(&state.generations),
        state
            .workspace_id
            .lock()
            .map_err(|_| "state lock failed")?
            .clone()
            .unwrap_or_default(),
    );
    Ok(workspace_state_value(
        workspace.as_ref(),
        state
            .workspace_id
            .lock()
            .map_err(|_| "state lock failed")?
            .as_deref(),
    ))
}

#[tauri::command]
fn workspace_refresh(state: State<'_, SpikeState>, workspace_id: String) -> SpikeResult {
    let workspace = state.workspace.lock().map_err(|_| "state lock failed")?;
    if state
        .workspace_id
        .lock()
        .map_err(|_| "state lock failed")?
        .as_deref()
        != Some(workspace_id.as_str())
    {
        return Err("workspace generation changed".to_string());
    }
    Ok(workspace_state_value(
        workspace.as_ref(),
        state
            .workspace_id
            .lock()
            .map_err(|_| "state lock failed")?
            .as_deref(),
    ))
}

#[tauri::command]
fn file_read_markdown(state: State<'_, SpikeState>, path: String) -> SpikeResult {
    let workspace = active_workspace(&state)?;
    let _guard = state.file_lock.lock().map_err(|_| "file lock failed")?;
    let target = security::resolve_existing_workspace_path(&workspace, &path)?;
    let content = std::fs::read_to_string(&target).map_err(|_| "read failed".to_string())?;
    security::validate_markdown_size(content.as_bytes())?;
    let name = target
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or_default();
    Ok(json!({ "ok": true, "value": { "content": content, "name": name, "path": path } }))
}

#[tauri::command]
fn file_write_markdown(
    state: State<'_, SpikeState>,
    path: String,
    content: String,
    expected_content: Option<String>,
) -> SpikeResult {
    let workspace = active_workspace(&state)?;
    let _guard = state.file_lock.lock().map_err(|_| "file lock failed")?;
    let target = security::resolve_existing_workspace_path(&workspace, &path)?;
    let current = std::fs::read_to_string(&target).map_err(|_| "read failed".to_string())?;
    security::validate_markdown_size(current.as_bytes())?;
    security::validate_markdown_size(content.as_bytes())?;
    if let Some(expected) = expected_content.as_deref() {
        security::validate_markdown_size(expected.as_bytes())?;
    }
    if security::verify_expected_content(&current, expected_content.as_deref()).is_err() {
        return Ok(
            json!({ "ok": false, "error": { "code": "FILE_CONFLICT", "message": "The file changed externally." } }),
        );
    }
    let target_before_replace = security::resolve_existing_workspace_path(&workspace, &path)?;
    if target_before_replace != target {
        return Err("FILE_RACE_UNPROVEN".to_string());
    }
    security::atomic_write(&target, content.as_bytes())?;
    Ok(json!({ "ok": true, "value": null }))
}

#[tauri::command]
fn output_save_preview_as_pdf() -> SpikeResult {
    Ok(json!({
        "ok": false,
        "error": {
            "code": "TAURI_SPIKE_UNSUPPORTED",
            "message": "PDF output is intentionally unsupported: Tauri 2 has no Electron webContents.printToPDF equivalent in this spike."
        }
    }))
}

fn active_workspace(state: &State<'_, SpikeState>) -> Result<PathBuf, String> {
    state
        .workspace
        .lock()
        .map_err(|_| "state lock failed")?
        .clone()
        .ok_or_else(|| "workspace is not selected".to_string())
}

fn stable_workspace_id(path: &PathBuf) -> String {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    path.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn workspace_state_value(path: Option<&PathBuf>, workspace_id: Option<&str>) -> Value {
    let active = path.map(|p| {
        let absolute = p.to_string_lossy().to_string();
        json!({ "id": workspace_id.unwrap_or("workspace-unknown"), "name": p.file_name().and_then(|v| v.to_str()).unwrap_or("Workspace"), "path": absolute })
    });
    json!({
        "ok": true,
        "value": {
            "activeWorkspace": active,
            "availability": { "fileOperationsAvailable": path.is_some(), "issues": [], "status": if path.is_some() { "available" } else { "unavailable" } },
            "fileTree": [],
            "fileIndex": [],
            "pinnedPaths": [],
            "workspaces": active.into_iter().collect::<Vec<_>>()
        }
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SpikeState::default())
        .invoke_handler(tauri::generate_handler![
            workspace_get_state,
            workspace_set_path,
            workspace_refresh,
            file_read_markdown,
            file_write_markdown,
            output_save_preview_as_pdf
        ])
        .setup(|app| {
            let _ = app.handle();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}

#[cfg(test)]
mod tests {
    use super::security;

    #[test]
    fn rejects_parent_and_absolute_paths() {
        assert!(security::validate_relative_path("../outside.md").is_err());
        assert!(security::validate_relative_path("/tmp/outside.md").is_err());
        assert!(security::validate_relative_path("safe\0.md").is_err());
        assert!(security::validate_relative_path("notes/today.md").is_ok());
    }
}
