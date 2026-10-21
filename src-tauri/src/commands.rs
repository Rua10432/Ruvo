use crate::models::{NoteEntry, NotebookEntry, NoteSearchResult, NoteMetadata};
use crate::{notebooks, notes, security};

#[tauri::command]
pub fn get_app_root() -> Result<String, String> {
    security::notebook_root().map(|path| security::path_string(&path))
}

#[tauri::command]
pub fn list_notebooks() -> Result<Vec<NotebookEntry>, String> {
    notebooks::list_notebooks()
}

#[tauri::command]
pub fn create_notebook(name: String) -> Result<NotebookEntry, String> {
    notebooks::create_notebook(name)
}

#[tauri::command]
pub fn delete_notebook(path: String) -> Result<(), String> {
    notebooks::delete_notebook(path)
}

#[tauri::command]
pub fn list_notes(notebook_path: String) -> Result<Vec<NoteEntry>, String> {
    notes::list_notes(notebook_path)
}

#[tauri::command]
pub fn read_note(path: String) -> Result<String, String> {
    notes::read_note(path)
}

#[tauri::command]
pub fn write_note(path: String, content: String) -> Result<(), String> {
    notes::write_note(path, content)
}

#[tauri::command]
pub fn create_note(notebook_path: String, requested_name: Option<String>) -> Result<NoteEntry, String> {
    notes::create_note(notebook_path, requested_name)
}

#[tauri::command]
pub fn rename_note(path: String, new_name: String) -> Result<NoteEntry, String> {
    notes::rename_note(path, new_name)
}

#[tauri::command]
pub fn delete_note(path: String) -> Result<(), String> {
    notes::delete_note(path)
}

#[tauri::command]
pub fn save_image_asset(notebook_path: String, filename: String, base64_data: String) -> Result<String, String> {
    notes::save_image_asset(notebook_path, filename, base64_data)
}

#[tauri::command]
pub async fn search_notes_content(notebook_path: String, query: String) -> Result<Vec<NoteSearchResult>, String> {
    tauri::async_runtime::spawn_blocking(move || notes::search_notes_content(notebook_path, query))
        .await
        .map_err(|e| format!("搜索任务失败: {e}"))?
}

#[tauri::command]
pub fn pick_save_path(
    default_name: String,
    extension: Option<String>,
    ext: Option<String>,
    filter_name: String,
) -> Result<Option<String>, String> {
    let extension = extension.or(ext).unwrap_or_default();
    notes::pick_save_path(default_name, extension, filter_name)
}

#[tauri::command]
pub fn write_binary_file(
    path: Option<String>,
    file_path: Option<String>,
    base64_data: String,
) -> Result<(), String> {
    let path = path.or(file_path).ok_or_else(|| "缺少文件路径".to_string())?;
    notes::write_binary_file(path, base64_data)
}

#[tauri::command]
pub fn get_note_metadata(path: String) -> Result<NoteMetadata, String> {
    notes::get_note_metadata(path)
}

#[tauri::command]
pub async fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(win) = app.get_webview_window("settings") {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    tauri::WebviewWindowBuilder::new(&app, "settings", tauri::WebviewUrl::App("index.html".into()))
        .title("偏好设置 - Ruvo")
        .inner_size(840.0, 600.0)
        .min_inner_size(680.0, 480.0)
        .resizable(true)
        .decorations(false)
        .shadow(false)
        .transparent(true)
        .center()
        .initialization_script("window.__RUVO_WINDOW_TYPE__ = 'settings'; window.__RUAM_WINDOW_TYPE__ = 'settings';")
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn close_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(win) = app.get_webview_window("settings") {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_sticky_note_window(
    app: tauri::AppHandle,
    note_path: String,
    note_title: String,
) -> Result<(), String> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    use tauri::Manager;

    let mut hasher = DefaultHasher::new();
    note_path.hash(&mut hasher);
    let hash_val = hasher.finish();
    let window_label = format!("sticky_{hash_val:016x}");

    if let Some(win) = app.get_webview_window(&window_label) {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let safe_path_json = serde_json::to_string(&note_path).unwrap_or_else(|_| "\"\"".to_string());
    let safe_title_json = serde_json::to_string(&note_title).unwrap_or_else(|_| "\"\"".to_string());
    let init_script = format!(
        "window.__RUVO_WINDOW_TYPE__ = 'sticky-note'; window.__RUAM_WINDOW_TYPE__ = 'sticky-note'; \
         window.__RUVO_STICKY_PATH__ = {0}; window.__RUAM_STICKY_PATH__ = {0}; \
         window.__RUVO_STICKY_TITLE__ = {1}; window.__RUAM_STICKY_TITLE__ = {1};",
        safe_path_json, safe_title_json
    );

    tauri::WebviewWindowBuilder::new(
        &app,
        &window_label,
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title(format!("便签 - {}", note_title))
    .inner_size(340.0, 440.0)
    .min_inner_size(260.0, 300.0)
    .resizable(true)
    .decorations(false)
    .shadow(false)
    .transparent(true)
    .always_on_top(true)
    .initialization_script(&init_script)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn set_window_always_on_top(window: tauri::WebviewWindow, always_on_top: bool) -> Result<(), String> {
    window.set_always_on_top(always_on_top).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_path_in_file_manager(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开文件资源管理器: {e}"))?;
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开文件资源管理器: {e}"))?;
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("无法打开文件资源管理器: {e}"))?;
        Ok(())
    }
}

#[tauri::command]
pub async fn minimize_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_maximize_window(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.is_maximized().map_err(|e| e.to_string())? {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn close_window(app: tauri::AppHandle, window: tauri::WebviewWindow) -> Result<(), String> {
    use tauri::Manager;
    let lbl = window.label();
    if lbl == "ruvo" || lbl == "ruam" || lbl == "main" {
        for (label, win) in app.webview_windows() {
            if label != "ruvo" && label != "ruam" && label != "main" {
                let _ = win.close();
            }
        }
    }
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn is_window_maximized(window: tauri::WebviewWindow) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn focus_main_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(win) = app
        .get_webview_window("ruvo")
        .or_else(|| app.get_webview_window("ruam"))
        .or_else(|| app.get_webview_window("main"))
    {
        let _ = win.unminimize();
        let _ = win.show();
        win.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}



