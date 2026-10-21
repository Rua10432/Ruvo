use std::fs;
use crate::models::NotebookEntry;
use crate::security::{canonical_existing, ensure_notebook_path, notebook_root, path_string, valid_name};

pub fn list_notebooks() -> Result<Vec<NotebookEntry>, String> {
    let root = notebook_root()?;
    let mut entries = Vec::new();
    for entry in fs::read_dir(&root).map_err(|error| format!("无法扫描笔记本目录: {error}"))? {
        let entry = entry.map_err(|error| format!("无法读取目录项: {error}"))?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let path = match ensure_notebook_path(&entry.path(), &root) {
            Ok(path) => path,
            Err(_) => continue,
        };
        entries.push(NotebookEntry {
            id: path_string(&path),
            name,
            path: path_string(&path),
        });
    }
    entries.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(entries)
}

pub fn create_notebook(name: String) -> Result<NotebookEntry, String> {
    let root = notebook_root()?;
    let name = name.trim();
    if !valid_name(name) {
        return Err("笔记本名称无效".to_string());
    }
    let path = root.join(name);
    if path.exists() {
        return Err("笔记本已存在".to_string());
    }
    fs::create_dir(&path).map_err(|error| format!("无法创建笔记本: {error}"))?;
    let path = canonical_existing(&path)?;
    Ok(NotebookEntry {
        id: path_string(&path),
        name: name.to_string(),
        path: path_string(&path),
    })
}

pub fn delete_notebook(path: String) -> Result<(), String> {
    let root = notebook_root()?;
    let path = ensure_notebook_path(std::path::Path::new(&path), &root)?;
    match trash::delete(&path) {
        Ok(_) => Ok(()),
        Err(err) => {
            eprintln!("警告: 移至系统回收站失败 ({err})，尝试直接删除目录: {:?}", path);
            fs::remove_dir_all(path).map_err(|e| format!("无法删除笔记本: {e}"))
        }
    }
}
