use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

static APP_ROOT: OnceLock<PathBuf> = OnceLock::new();
static NOTEBOOK_ROOT: OnceLock<PathBuf> = OnceLock::new();

pub fn app_root() -> Result<PathBuf, String> {
    if let Some(cached) = APP_ROOT.get() {
        return Ok(cached.clone());
    }
    let executable = std::env::current_exe().map_err(|error| format!("无法获取应用程序路径: {error}"))?;
    let directory = executable.parent().ok_or_else(|| "无法确定应用程序根目录".to_string())?;
    let canonical = canonical_existing(directory)?;
    let _ = APP_ROOT.set(canonical.clone());
    Ok(canonical)
}

pub fn notebook_root() -> Result<PathBuf, String> {
    if let Some(cached) = NOTEBOOK_ROOT.get() {
        return Ok(cached.clone());
    }
    let app_dir = app_root()?;
    let notebook_dir = app_dir.join("notebook");
    if !notebook_dir.exists() {
        fs::create_dir_all(&notebook_dir).map_err(|error| format!("无法创建 notebook 目录: {error}"))?;
    }
    let canonical = canonical_existing(&notebook_dir)?;
    let _ = NOTEBOOK_ROOT.set(canonical.clone());
    Ok(canonical)
}

pub fn canonical_existing(path: &Path) -> Result<PathBuf, String> {
    fs::canonicalize(path).map_err(|error| format!("无法访问路径: {error}"))
}

pub fn ensure_under_root(path: &Path, root: &Path) -> Result<PathBuf, String> {
    let path = canonical_existing(path)?;
    if !path.starts_with(root) {
        return Err("路径必须位于 notebook 根目录内".to_string());
    }
    Ok(path)
}

pub fn ensure_notebook_path(path: &Path, root: &Path) -> Result<PathBuf, String> {
    let path = ensure_under_root(path, root)?;
    if path.parent() != Some(root) || !path.is_dir() {
        return Err("笔记本必须是 notebook 根目录下的一级目录".to_string());
    }
    Ok(path)
}

pub fn ensure_note_path(path: &Path, root: &Path) -> Result<PathBuf, String> {
    let path = ensure_under_root(path, root)?;
    if path.extension().and_then(|value| value.to_str()).map(|value| value.eq_ignore_ascii_case("md")) != Some(true) {
        return Err("只允许读写 .md 文件".to_string());
    }
    let notebook = path.parent().ok_or_else(|| "无效笔记路径".to_string())?;
    ensure_notebook_path(notebook, root)?;
    Ok(path)
}

pub fn path_string(path: &Path) -> String {
    let path = path.to_string_lossy();
    if let Some(path) = path.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{path}")
    } else {
        path.strip_prefix(r"\\?\").unwrap_or(&path).to_string()
    }
}

pub fn valid_name(name: &str) -> bool {
    if name.is_empty() || name == "." || name == ".." || name.ends_with('.') || name.ends_with(' ') {
        return false;
    }
    if name.chars().any(|character| character < ' ' || matches!(character, '/' | '\\' | ':' | '<' | '>' | '"' | '|' | '?' | '*')) {
        return false;
    }
    let basename = name.split('.').next().unwrap_or(name).to_ascii_uppercase();
    if matches!(basename.as_str(), "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$") || basename.contains('$') {
        return false;
    }
    if (basename.starts_with("COM") || basename.starts_with("LPT")) && basename.len() == 4 && basename.as_bytes()[3].is_ascii_digit() {
        return false;
    }
    true
}
