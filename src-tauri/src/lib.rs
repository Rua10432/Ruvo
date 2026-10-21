pub mod commands;
pub mod models;
pub mod notebooks;
pub mod notes;
pub mod security;
pub mod sys_check;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 检查操作系统版本是否满足最低运行要求，如不满足则弹出系统原生警告框并退出
    sys_check::check_system_requirements();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_snap_layout::init()
                .button_id("titlebar-maximize")
                .build(),
        )
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed => {
                    let lbl = window.label();
                    if lbl == "ruvo" || lbl == "ruam" || lbl == "main" {
                        use tauri::Manager;
                        for (label, win) in window.app_handle().webview_windows() {
                            if label != "ruvo" && label != "ruam" && label != "main" {
                                let _ = win.close();
                            }
                        }
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::get_app_root,
            commands::list_notebooks,
            commands::create_notebook,
            commands::delete_notebook,
            commands::list_notes,
            commands::read_note,
            commands::write_note,
            commands::create_note,
            commands::rename_note,
            commands::delete_note,
            commands::save_image_asset,
            commands::search_notes_content,
            commands::open_settings_window,
            commands::close_settings_window,
            commands::open_path_in_file_manager,
            commands::minimize_window,
            commands::toggle_maximize_window,
            commands::close_window,
            commands::is_window_maximized,
            commands::pick_save_path,
            commands::write_binary_file,
            commands::get_note_metadata,
            commands::open_sticky_note_window,
            commands::set_window_always_on_top,
            commands::focus_main_window,
            sys_check::get_system_requirements_info,
            sys_check::open_windows_11_website,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
