use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::ErrorKind;
use std::path::Path;
use std::sync::{Arc, RwLock, OnceLock};
use std::time::{Duration, Instant};
use base64::Engine;
use chrono::{DateTime, Local};
use crate::models::{NoteEntry, NoteMetadata, NoteSearchResult};
use crate::security::{
    notebook_root, canonical_existing, ensure_note_path, ensure_notebook_path, path_string, valid_name,
};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
pub struct NoteStatsEntry {
    #[serde(default)]
    pub edit_count: u32,
    #[serde(default)]
    pub last_modified_by: String,
}

fn get_current_user() -> String {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "本地用户".to_string())
}

struct StatsCache {
    data: HashMap<String, HashMap<String, NoteStatsEntry>>,
    dirty: HashSet<String>,
    last_flush: Instant,
}

static STATS_CACHE: OnceLock<Arc<RwLock<StatsCache>>> = OnceLock::new();

fn stats_cache() -> Arc<RwLock<StatsCache>> {
    STATS_CACHE.get_or_init(|| {
        Arc::new(RwLock::new(StatsCache {
            data: HashMap::new(),
            dirty: HashSet::new(),
            last_flush: Instant::now(),
        }))
    }).clone()
}

fn stats_file_path(notebook_dir: &Path) -> std::path::PathBuf {
    let ruvo_path = notebook_dir.join(".ruvo_stats.json");
    if ruvo_path.exists() {
        return ruvo_path;
    }
    let ruam_path = notebook_dir.join(".ruam_stats.json");
    if ruam_path.exists() {
        return ruam_path;
    }
    ruvo_path
}

fn load_notebook_stats(notebook_dir: &Path) -> HashMap<String, NoteStatsEntry> {
    let key = notebook_dir.to_string_lossy().to_string();
    let cache = stats_cache();
    if let Ok(guard) = cache.read() {
        if let Some(cached) = guard.data.get(&key) {
            return cached.clone();
        }
    }
    // Fall through to disk read
    let stats_path = stats_file_path(notebook_dir);
    if !stats_path.exists() {
        return HashMap::new();
    }
    let result = match fs::read_to_string(&stats_path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => HashMap::new(),
    };
    // Cache it
    if let Ok(mut guard) = cache.write() {
        guard.data.insert(key, result.clone());
    }
    result
}

fn save_notebook_stats(notebook_dir: &Path, stats: &HashMap<String, NoteStatsEntry>) {
    let key = notebook_dir.to_string_lossy().to_string();
    let cache = stats_cache();
    if let Ok(mut guard) = cache.write() {
        guard.data.insert(key.clone(), stats.clone());
        guard.dirty.insert(key.clone());

        // Only flush to disk if 5+ seconds since last flush
        if guard.last_flush.elapsed() >= Duration::from_secs(5) {
            let dirty_keys: Vec<String> = guard.dirty.drain().collect();
            guard.last_flush = Instant::now();
            for dk in &dirty_keys {
                if let Some(data) = guard.data.get(dk) {
                    let dir_path = std::path::Path::new(dk);
                    let ruvo_path = dir_path.join(".ruvo_stats.json");
                    if let Ok(json) = serde_json::to_string_pretty(data) {
                        let _ = fs::write(&ruvo_path, json);
                    }
                }
            }
        }
    };
}

pub fn list_notes(notebook_path: String) -> Result<Vec<NoteEntry>, String> {
    let root = notebook_root()?;
    let notebook = ensure_notebook_path(Path::new(&notebook_path), &root)?;
    let notebook_name = notebook.file_name().map(|value| value.to_string_lossy().into_owned()).unwrap_or_default();
    let notebook_id = path_string(&notebook);
    let mut notes = Vec::new();
    for entry in fs::read_dir(&notebook).map_err(|error| format!("无法扫描笔记本: {error}"))? {
        let entry = entry.map_err(|error| format!("无法读取笔记项: {error}"))?;
        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        if !file_type.is_file() {
            continue;
        }
        let file_name = entry.file_name();
        let file_name_str = file_name.to_string_lossy();
        if !file_name_str.to_lowercase().ends_with(".md") {
            continue;
        }
        let stem = if file_name_str.len() >= 3 {
            &file_name_str[..file_name_str.len() - 3]
        } else {
            continue;
        };
        if !valid_name(stem) {
            continue;
        }
        let full_path = notebook.join(&file_name);
        let path_str = path_string(&full_path);
        let name = file_name_str.into_owned();
        notes.push(NoteEntry {
            id: path_str.clone(),
            name,
            path: path_str,
            notebook_id: notebook_id.clone(),
            notebook_name: notebook_name.clone(),
        });
    }
    notes.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(notes)
}

pub fn read_note(path: String) -> Result<String, String> {
    let root = notebook_root()?;
    let path = ensure_note_path(Path::new(&path), &root)?;
    fs::read_to_string(path).map_err(|error| format!("无法读取笔记: {error}"))
}

pub fn write_note(path: String, content: String) -> Result<(), String> {
    let root = notebook_root()?;
    let path = ensure_note_path(Path::new(&path), &root)?;

    // Atomic file replacement to prevent 0-byte corruption on crash/power cut
    let parent = path.parent().ok_or_else(|| "无效的笔记路径".to_string())?;
    let temp_name = format!(".tmp_note_{}_{}.tmp", std::process::id(), chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0));
    let temp_path = parent.join(&temp_name);

    {
        use std::io::Write;
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_path)
            .map_err(|error| format!("无法创建临时写入文件: {error}"))?;

        file.write_all(content.as_bytes())
            .map_err(|error| {
                let _ = fs::remove_file(&temp_path);
                format!("写入临时文件失败: {error}")
            })?;

        file.flush()
            .map_err(|error| {
                let _ = fs::remove_file(&temp_path);
                format!("刷新缓冲区失败: {error}")
            })?;
    }

    if let Err(e) = fs::rename(&temp_path, &path) {
        let _ = fs::remove_file(&temp_path);
        return Err(format!("原子重命名替换笔记文件失败: {e}"));
    }

    let filename = path.file_name().map(|value| value.to_string_lossy().into_owned()).unwrap_or_default();
    if !filename.is_empty() {
        let mut stats = load_notebook_stats(parent);
        let entry = stats.entry(filename).or_insert_with(|| NoteStatsEntry {
            edit_count: 0,
            last_modified_by: get_current_user(),
        });
        entry.edit_count += 1;
        entry.last_modified_by = get_current_user();
        save_notebook_stats(parent, &stats);
    }
    Ok(())
}

pub fn create_note(notebook_path: String, requested_name: Option<String>) -> Result<NoteEntry, String> {
    let root = notebook_root()?;
    let notebook = ensure_notebook_path(Path::new(&notebook_path), &root)?;
    let notebook_name = notebook.file_name().map(|value| value.to_string_lossy().into_owned()).unwrap_or_default();
    let notebook_id = path_string(&notebook);
    let base = requested_name.unwrap_or_else(|| "未命名.md".to_string());
    let base = base.trim();
    let stem = base.strip_suffix(".md").or_else(|| base.strip_suffix(".MD")).unwrap_or(base);
    if !valid_name(stem) {
        return Err("笔记名称无效".to_string());
    }
    let mut index = 1;
    let path = loop {
        if index > 999 {
            return Err("创建笔记失败：超出自动命名重试上限 (999)".to_string());
        }
        let filename = if index == 1 { format!("{stem}.md") } else { format!("{stem} ({index}).md") };
        let candidate = notebook.join(filename);
        match fs::OpenOptions::new().write(true).create_new(true).open(&candidate) {
            Ok(_) => break candidate,
            Err(error) if error.kind() == ErrorKind::AlreadyExists => index += 1,
            Err(error) => return Err(format!("无法创建笔记: {error}")),
        }
    };
    let path = canonical_existing(&path)?;
    let name = path.file_name().map(|value| value.to_string_lossy().into_owned()).unwrap_or_default();
    Ok(NoteEntry {
        id: path_string(&path),
        name,
        path: path_string(&path),
        notebook_id,
        notebook_name,
    })
}

pub fn rename_note(path: String, new_name: String) -> Result<NoteEntry, String> {
    let root = notebook_root()?;
    let old_path = ensure_note_path(Path::new(&path), &root)?;
    let notebook = old_path.parent().ok_or_else(|| "无效笔记路径".to_string())?;
    let notebook_name = notebook.file_name().map(|value| value.to_string_lossy().into_owned()).unwrap_or_default();
    let notebook_id = path_string(notebook);

    let base = new_name.trim();
    let stem = base.strip_suffix(".md").or_else(|| base.strip_suffix(".MD")).unwrap_or(base);
    if !valid_name(stem) {
        return Err("笔记名称无效".to_string());
    }
    let new_filename = format!("{stem}.md");
    let new_path = notebook.join(&new_filename);
    if new_path.exists() && new_path != old_path {
        return Err("同名笔记已存在".to_string());
    }
    fs::rename(&old_path, &new_path).map_err(|error| format!("无法重命名笔记: {error}"))?;
    let new_path = canonical_existing(&new_path)?;
    let name = new_path.file_name().map(|value| value.to_string_lossy().into_owned()).unwrap_or_default();

    let old_filename = old_path.file_name().map(|value| value.to_string_lossy().into_owned()).unwrap_or_default();
    if !old_filename.is_empty() && !name.is_empty() && old_filename != name {
        let mut stats = load_notebook_stats(notebook);
        if let Some(entry) = stats.remove(&old_filename) {
            stats.insert(name.clone(), entry);
            save_notebook_stats(notebook, &stats);
        }
    }

    Ok(NoteEntry {
        id: path_string(&new_path),
        name,
        path: path_string(&new_path),
        notebook_id,
        notebook_name,
    })
}

pub fn delete_note(path: String) -> Result<(), String> {
    let root = notebook_root()?;
    let path = ensure_note_path(Path::new(&path), &root)?;
    if let Some(notebook) = path.parent() {
        let filename = path.file_name().map(|f| f.to_string_lossy().into_owned()).unwrap_or_default();
        if !filename.is_empty() {
            let mut stats = load_notebook_stats(notebook);
            if stats.remove(&filename).is_some() {
                save_notebook_stats(notebook, &stats);
            }
        }
    }
    match trash::delete(&path) {
        Ok(_) => Ok(()),
        Err(err) => {
            eprintln!("警告: 移入系统回收站失败 ({err})，尝试直接删除文件: {:?}", path);
            fs::remove_file(path).map_err(|e| format!("无法删除笔记: {e}"))
        }
    }
}

pub fn save_image_asset(notebook_path: String, filename: String, base64_data: String) -> Result<String, String> {
    let root = notebook_root()?;
    let notebook = ensure_notebook_path(Path::new(&notebook_path), &root)?;

    let raw_filename = filename.trim();
    if raw_filename.is_empty() {
        return Err("图片文件名不能为空".to_string());
    }

    let file_path = Path::new(raw_filename);
    let file_name_os = file_path.file_name().ok_or_else(|| "无效的文件名".to_string())?;
    let mut safe_filename = file_name_os.to_string_lossy().into_owned();

    let lower_name = safe_filename.to_lowercase();
    if !lower_name.ends_with(".png")
        && !lower_name.ends_with(".jpg")
        && !lower_name.ends_with(".jpeg")
        && !lower_name.ends_with(".gif")
        && !lower_name.ends_with(".webp")
        && !lower_name.ends_with(".svg")
        && !lower_name.ends_with(".bmp")
    {
        safe_filename = format!("{safe_filename}.png");
    }

    let stem = Path::new(&safe_filename).file_stem().and_then(|s| s.to_str()).unwrap_or("image").to_string();
    if !valid_name(&stem) {
        let clean_stem: String = stem.chars().filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-').collect();
        let fallback_stem = if clean_stem.is_empty() { "image".to_string() } else { clean_stem };
        safe_filename = format!("{fallback_stem}.png");
    }

    let dos_reserved = [
        "con", "prn", "aux", "nul",
        "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
        "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
    ];
    let lower_stem = stem.trim().trim_end_matches('.').to_lowercase();
    if dos_reserved.contains(&lower_stem.as_str()) {
        safe_filename = format!("img_{safe_filename}");
    }

    let assets_dir = notebook.join("assets");
    if !assets_dir.exists() {
        fs::create_dir_all(&assets_dir).map_err(|e| format!("无法创建 assets 目录: {e}"))?;
    }

    let raw_base64 = if let Some(idx) = base64_data.find(";base64,") {
        &base64_data[idx + 8..]
    } else if let Some(idx) = base64_data.find(',') {
        &base64_data[idx + 1..]
    } else {
        &base64_data
    };

    let clean_base64: String = raw_base64.chars().filter(|c| !c.is_whitespace()).collect();

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&clean_base64)
        .map_err(|e| format!("Base64 解码失败: {e}"))?;

    let mut target_file = assets_dir.join(&safe_filename);
    if target_file.exists() {
        let ext = Path::new(&safe_filename).extension().and_then(|s| s.to_str()).unwrap_or("png");
        let stem = Path::new(&safe_filename).file_stem().and_then(|s| s.to_str()).unwrap_or("image");
        let timestamp = chrono::Utc::now().timestamp_millis();
        safe_filename = format!("{stem}_{timestamp}.{ext}");
        target_file = assets_dir.join(&safe_filename);
    }

    fs::write(&target_file, bytes).map_err(|e| format!("无法保存图片资源文件: {e}"))?;

    Ok(format!("./assets/{safe_filename}"))
}

pub fn search_notes_content(notebook_path: String, query: String) -> Result<Vec<NoteSearchResult>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let root = notebook_root()?;
    let notebook = ensure_notebook_path(Path::new(&notebook_path), &root)?;

    let query_lower = query.to_lowercase();
    let mut results = Vec::new();
    const MAX_RESULTS: usize = 60;

    let entries = fs::read_dir(&notebook).map_err(|e| format!("无法扫描笔记本目录: {e}"))?;
    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        if !file_type.is_file() {
            continue;
        }

        let file_name = entry.file_name();
        let file_name_str = file_name.to_string_lossy();
        if !file_name_str.to_lowercase().ends_with(".md") {
            continue;
        }

        let stem = if file_name_str.len() >= 3 {
            &file_name_str[..file_name_str.len() - 3]
        } else {
            continue;
        };
        if !valid_name(stem) {
            continue;
        }

        let full_path = notebook.join(&file_name);
        let path_str = path_string(&full_path);
        let note_name = file_name_str.into_owned();

        let content = match fs::read_to_string(&full_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        for (idx, line) in content.lines().enumerate() {
            // Zero-allocation: check if line contains query (case-insensitive) without allocating a new String
            let match_pos = if line.is_ascii() {
                // Fast path for pure-ASCII lines: compare bytes directly
                line.as_bytes().windows(query_lower.len()).position(|window| {
                    window.iter().zip(query_lower.as_bytes()).all(|(a, b)| a.to_ascii_lowercase() == *b)
                })
            } else {
                // Fallback for non-ASCII: allocate once
                line.to_lowercase().find(&query_lower)
            };
            if let Some(match_pos) = match_pos {
                let trimmed_line = line.trim();
                let snippet = if trimmed_line.chars().count() > 120 {
                    let char_indices: Vec<(usize, char)> = line.char_indices().collect();
                    let char_count = char_indices.len();
                    let match_char_idx = char_indices
                        .iter()
                        .position(|(byte_idx, _)| *byte_idx >= match_pos)
                        .unwrap_or(0);

                    let start_char = match_char_idx.saturating_sub(40);
                    let end_char = (start_char + 100).min(char_count);

                    let start_byte = char_indices[start_char].0;
                    let end_byte = if end_char < char_count {
                        char_indices[end_char].0
                    } else {
                        line.len()
                    };

                    let prefix = if start_char > 0 { "..." } else { "" };
                    let suffix = if end_char < char_count { "..." } else { "" };
                    format!("{}{}{}", prefix, &line[start_byte..end_byte].trim(), suffix)
                } else {
                    trimmed_line.to_string()
                };

                results.push(NoteSearchResult {
                    note_path: path_str.clone(),
                    note_name: note_name.clone(),
                    line_number: idx + 1,
                    snippet: snippet.clone(),
                    line_content: snippet,
                });

                if results.len() >= MAX_RESULTS {
                    return Ok(results);
                }
            }
        }
    }

    Ok(results)
}

pub fn get_note_metadata(path: String) -> Result<NoteMetadata, String> {
    let root = notebook_root()?;
    let note_path = ensure_note_path(Path::new(&path), &root)?;
    let meta = fs::metadata(&note_path).map_err(|error| format!("无法读取笔记元数据: {error}"))?;

    let filename = note_path.file_name().map(|value| value.to_string_lossy().into_owned()).unwrap_or_default();
    let notebook_dir = note_path.parent().ok_or_else(|| "无效笔记本目录".to_string())?;

    let mtime = meta.modified().unwrap_or_else(|_| std::time::SystemTime::now());
    let ctime = meta.created().unwrap_or(mtime);

    let created_at = DateTime::<Local>::from(ctime).format("%Y-%m-%d %H:%M:%S").to_string();
    let modified_at = DateTime::<Local>::from(mtime).format("%Y-%m-%d %H:%M:%S").to_string();

    let stats = load_notebook_stats(notebook_dir);
    let current_user = get_current_user();
    let (edit_count, last_modified_by) = match stats.get(&filename) {
        Some(entry) => (
            if entry.edit_count == 0 { 1 } else { entry.edit_count },
            if entry.last_modified_by.is_empty() { current_user } else { entry.last_modified_by.clone() },
        ),
        None => (1, current_user),
    };

    Ok(NoteMetadata {
        filename,
        path: path_string(&note_path),
        created_at,
        modified_at,
        edit_count,
        last_modified_by,
        file_size_bytes: meta.len(),
    })
}

pub fn pick_save_path(default_name: String, extension: String, filter_name: String) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new().set_file_name(&default_name);
    let clean_ext = extension.strip_prefix('.').unwrap_or(&extension).trim();
    if !clean_ext.is_empty() {
        dialog = dialog.add_filter(&filter_name, &[clean_ext]);
    }
    let res = dialog.save_file();
    Ok(res.map(|mut p| {
        if p.extension().is_none() && !clean_ext.is_empty() {
            p.set_extension(clean_ext);
        }
        p.to_string_lossy().into_owned()
    }))
}

pub fn write_binary_file(path: String, base64_data: String) -> Result<(), String> {
    let mut file_path = std::path::PathBuf::from(&path);

    // Path traversal check
    if path.contains("..") {
        return Err("安全拦截：文件路径包含非法相对遍历符号 (..)".to_string());
    }

    let raw_base64 = if let Some(idx) = base64_data.find(";base64,") {
        &base64_data[idx + 8..]
    } else if let Some(idx) = base64_data.find(',') {
        &base64_data[idx + 1..]
    } else {
        &base64_data
    };

    let clean_base64: String = raw_base64.chars().filter(|c| !c.is_whitespace()).collect();

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&clean_base64)
        .map_err(|e| format!("Base64 解码失败: {e}"))?;

    // If file extension is omitted, auto-detect extension based on binary magic bytes
    if file_path.extension().is_none() {
        if bytes.starts_with(b"%PDF") {
            file_path.set_extension("pdf");
        } else if bytes.starts_with(&[0x50, 0x4B, 0x03, 0x04]) {
            file_path.set_extension("docx");
        }
    }

    // Security check: Only allow .docx and .pdf exports
    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    if ext != "docx" && ext != "pdf" {
        return Err("安全拦截：二进制写入仅允许导出 .docx 或 .pdf 文件".to_string());
    }

    if let Some(parent) = file_path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            let _ = fs::create_dir_all(parent);
        }
    }

    fs::write(&file_path, bytes).map_err(|e| format!("无法写入二进制文件: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notebooks::create_notebook;

    #[test]
    fn test_save_image_asset_and_search() {
        let test_nb = create_notebook("test_vault_search_asset".to_string()).expect("create test nb");
        let note = create_note(test_nb.path.clone(), Some("search_test.md".to_string())).expect("create note");

        let content = "Hello world\nThis is a line with Ruvo Search Target\nAnother line without keyword";
        write_note(note.path.clone(), content.to_string()).expect("write note");

        // Test search
        let results = search_notes_content(test_nb.path.clone(), "Search Target".to_string()).expect("search");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].line_number, 2);
        assert!(results[0].snippet.contains("Ruvo Search Target"));
        assert!(results[0].line_content.contains("Ruvo Search Target"));

        // Case-insensitive test
        let results_lower = search_notes_content(test_nb.path.clone(), "search target".to_string()).expect("search lower");
        assert_eq!(results_lower.len(), 1);

        // Test save image asset
        let sample_base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        let rel_path = save_image_asset(test_nb.path.clone(), "sample_image.png".to_string(), sample_base64.to_string()).expect("save image");
        assert_eq!(rel_path, "./assets/sample_image.png");

        let saved_file = Path::new(&test_nb.path).join("assets").join("sample_image.png");
        assert!(saved_file.exists());
        let file_bytes = fs::read(&saved_file).expect("read saved image");
        assert_eq!(file_bytes.len(), 70);

        // Cleanup
        let _ = delete_note(note.path);
        let _ = fs::remove_dir_all(Path::new(&test_nb.path));
    }

    #[test]
    fn test_note_metadata_and_binary_file() {
        let root = notebook_root().unwrap();
        let _ = fs::remove_dir_all(root.join("test_vault_metadata"));
        let test_nb = create_notebook("test_vault_metadata".to_string()).expect("create test nb");
        let note = create_note(test_nb.path.clone(), Some("meta_test.md".to_string())).expect("create note");

        // Initial metadata without write_note (default edit_count = 1)
        let initial_meta = get_note_metadata(note.path.clone()).expect("get initial meta");
        assert_eq!(initial_meta.filename, "meta_test.md");
        assert_eq!(initial_meta.edit_count, 1);
        assert!(!initial_meta.created_at.is_empty());
        assert!(!initial_meta.modified_at.is_empty());

        // First write
        write_note(note.path.clone(), "# Hello".to_string()).expect("write note 1");
        let meta1 = get_note_metadata(note.path.clone()).expect("get meta 1");
        assert_eq!(meta1.edit_count, 1);
        assert_eq!(meta1.file_size_bytes, 7);

        // Second write
        write_note(note.path.clone(), "# Hello World".to_string()).expect("write note 2");
        let meta2 = get_note_metadata(note.path.clone()).expect("get meta 2");
        assert_eq!(meta2.edit_count, 2);
        assert_eq!(meta2.file_size_bytes, 13);

        // Binary write test (.docx / .pdf security policy)
        let test_bin_path = Path::new(&test_nb.path).join("test_file.docx");
        let sample_base64 = "data:application/octet-stream;base64,AQIDBA==";
        write_binary_file(test_bin_path.to_string_lossy().into_owned(), sample_base64.to_string()).expect("write binary");
        assert!(test_bin_path.exists());
        let bin_bytes = fs::read(&test_bin_path).expect("read binary");
        assert_eq!(bin_bytes, vec![1, 2, 3, 4]);

        // Binary write auto-detect extension for PDF without extension
        let auto_pdf_path = Path::new(&test_nb.path).join("auto_pdf");
        let pdf_base64 = base64::engine::general_purpose::STANDARD.encode(b"%PDF-1.5 test");
        write_binary_file(auto_pdf_path.to_string_lossy().into_owned(), pdf_base64).expect("write auto pdf");
        let expected_pdf = Path::new(&test_nb.path).join("auto_pdf.pdf");
        assert!(expected_pdf.exists());
        assert_eq!(fs::read(&expected_pdf).expect("read auto pdf"), b"%PDF-1.5 test");

        // Binary write auto-detect extension for DOCX without extension
        let auto_docx_path = Path::new(&test_nb.path).join("auto_docx");
        let docx_base64 = base64::engine::general_purpose::STANDARD.encode(&[0x50, 0x4B, 0x03, 0x04, 0x14, 0x00]);
        write_binary_file(auto_docx_path.to_string_lossy().into_owned(), docx_base64).expect("write auto docx");
        let expected_docx = Path::new(&test_nb.path).join("auto_docx.docx");
        assert!(expected_docx.exists());
        assert_eq!(fs::read(&expected_docx).expect("read auto docx"), vec![0x50, 0x4B, 0x03, 0x04, 0x14, 0x00]);

        // Binary write without extension and non-matching bytes should fail security check
        let invalid_path = Path::new(&test_nb.path).join("invalid_no_ext");
        let invalid_res = write_binary_file(invalid_path.to_string_lossy().into_owned(), sample_base64.to_string());
        assert!(invalid_res.is_err());

        // Cleanup
        let _ = delete_note(note.path);
        let _ = fs::remove_dir_all(Path::new(&test_nb.path));
    }
}
