use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub const MAX_MARKDOWN_BYTES: usize = 5 * 1024 * 1024;

pub fn validate_relative_path(value: &str) -> Result<(), String> {
    if value.is_empty() || value.contains('\0') || value.contains('\\') {
        return Err("invalid path".to_string());
    }
    let path = Path::new(value);
    if path.is_absolute() {
        return Err("absolute path is not allowed".to_string());
    }
    if !value.ends_with(".md") {
        return Err("only markdown files are allowed".to_string());
    }
    let mut normalized = String::new();
    for component in path.components() {
        match component {
            Component::Normal(component) => {
                let text = component
                    .to_str()
                    .ok_or_else(|| "invalid path".to_string())?;
                if text.starts_with('.') {
                    return Err("hidden paths are not allowed".to_string());
                }
                if !normalized.is_empty() {
                    normalized.push('/');
                }
                normalized.push_str(text);
            }
            Component::CurDir => return Err("path is not normalized".to_string()),
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("path escapes workspace".to_string())
            }
        }
    }
    if normalized != value.replace(std::path::MAIN_SEPARATOR, "/") {
        return Err("path is not normalized".to_string());
    }
    Ok(())
}

pub fn canonical_workspace(value: &str) -> Result<PathBuf, String> {
    let path = Path::new(value);
    if !path.is_absolute() || value.contains('\0') {
        return Err("workspace must be an absolute path".to_string());
    }
    let canonical = fs::canonicalize(path).map_err(|_| "workspace does not exist".to_string())?;
    if !canonical.is_dir() {
        return Err("workspace is not a directory".to_string());
    }
    Ok(canonical)
}

pub fn resolve_existing_workspace_path(
    workspace: &Path,
    relative: &str,
) -> Result<PathBuf, String> {
    validate_relative_path(relative)?;
    let target = workspace.join(relative);
    let canonical = fs::canonicalize(&target).map_err(|_| "file does not exist".to_string())?;
    if !canonical.starts_with(workspace) {
        return Err("path is outside workspace".to_string());
    }
    Ok(canonical)
}

#[allow(dead_code)]
pub fn resolve_new_workspace_path(workspace: &Path, relative: &str) -> Result<PathBuf, String> {
    validate_relative_path(relative)?;
    let target = workspace.join(relative);
    let mut parent = target
        .parent()
        .ok_or_else(|| "missing parent".to_string())?;
    while !parent.exists() {
        parent = parent
            .parent()
            .ok_or_else(|| "missing parent".to_string())?;
    }
    let canonical_parent =
        fs::canonicalize(parent).map_err(|_| "parent does not exist".to_string())?;
    if !canonical_parent.starts_with(workspace) {
        return Err("new path parent is outside workspace".to_string());
    }
    Ok(target)
}

pub fn verify_expected_content(current: &str, expected: Option<&str>) -> Result<(), String> {
    if let Some(expected) = expected {
        if current != expected {
            return Err("FILE_CONFLICT".to_string());
        }
    }
    Ok(())
}

pub fn validate_markdown_size(bytes: &[u8]) -> Result<(), String> {
    if bytes.len() > MAX_MARKDOWN_BYTES {
        return Err("markdown exceeds 5 MiB limit".to_string());
    }
    std::str::from_utf8(bytes).map_err(|_| "markdown must be valid UTF-8".to_string())?;
    Ok(())
}

pub fn atomic_write(target: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = target
        .parent()
        .ok_or_else(|| "missing parent".to_string())?;
    let parent = fs::canonicalize(parent).map_err(|_| "parent does not exist".to_string())?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temp = parent.join(format!(".relic-tauri-spike-{stamp}.tmp"));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp)
        .map_err(|_| "temporary file create failed".to_string())?;
    if file.write_all(bytes).is_err() {
        let _ = fs::remove_file(&temp);
        return Err("temporary file write failed".to_string());
    }
    if file.sync_all().is_err() {
        let _ = fs::remove_file(&temp);
        return Err("temporary file sync failed".to_string());
    }
    drop(file);
    if let Err(_) = fs::rename(&temp, target) {
        let _ = fs::remove_file(&temp);
        return Err("atomic replace failed".to_string());
    }
    // Directory durability is required after rename. std::fs has no portable
    // directory fsync; this is a deliberate adoption blocker on platforms
    // where opening a directory for sync is not supported.
    let directory = OpenOptions::new()
        .read(true)
        .open(&parent)
        .map_err(|_| "parent directory sync unsupported".to_string())?;
    if directory.sync_all().is_err() {
        return Err("parent directory sync failed".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atomic_write_replaces_content_without_temp_remnant() {
        let root = std::env::temp_dir().join(format!("relic-tauri-spike-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let target = root.join("note.md");
        fs::write(&target, "before").unwrap();
        atomic_write(&target, b"after").unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "after");
        assert_eq!(fs::read_dir(&root).unwrap().count(), 1);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn new_path_rejects_external_parent() {
        let root =
            std::env::temp_dir().join(format!("relic-tauri-spike-root-{}", std::process::id()));
        let outside =
            std::env::temp_dir().join(format!("relic-tauri-spike-outside-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside).unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(&outside, root.join("escape")).unwrap();
        #[cfg(unix)]
        assert!(resolve_new_workspace_path(&root, "escape/new.md").is_err());
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
    }

    #[test]
    fn atomic_write_failure_leaves_target_unchanged() {
        let root =
            std::env::temp_dir().join(format!("relic-tauri-spike-failure-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let target = root.join("note.md");
        fs::write(&target, "before").unwrap();
        let missing_target = root.join("missing").join("note.md");
        assert!(atomic_write(&missing_target, b"after").is_err());
        assert_eq!(fs::read_to_string(&target).unwrap(), "before");
        assert_eq!(fs::read_dir(&root).unwrap().count(), 1);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn expected_content_conflict_is_rejected_without_comparison_side_effects() {
        let result = verify_expected_content("current", Some("stale"));
        assert_eq!(result, Err("FILE_CONFLICT".to_string()));
        assert!(verify_expected_content("current", Some("current")).is_ok());
        assert!(verify_expected_content("current", None).is_ok());
    }

    #[test]
    fn path_contract_rejects_non_normalized_hidden_and_non_markdown() {
        for value in [
            "./note.md",
            "notes/./note.md",
            ".hidden.md",
            "notes/.hidden.md",
            "note.txt",
            "notes\\note.md",
        ] {
            assert!(validate_relative_path(value).is_err(), "{value}");
        }
        assert!(validate_relative_path("notes/note.md").is_ok());
    }

    #[test]
    fn markdown_size_and_utf8_limits_are_enforced() {
        assert!(validate_markdown_size(b"ok").is_ok());
        assert!(validate_markdown_size(&vec![b'a'; MAX_MARKDOWN_BYTES + 1]).is_err());
        assert!(validate_markdown_size(&[0xff]).is_err());
    }
}
