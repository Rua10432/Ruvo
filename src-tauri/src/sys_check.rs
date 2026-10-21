#[cfg(target_os = "windows")]
pub mod windows_impl {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "user32")]
    extern "system" {
        fn MessageBoxW(
            hWnd: *mut std::ffi::c_void,
            lpText: *const u16,
            lpCaption: *const u16,
            uType: u32,
        ) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn LoadLibraryW(lpLibFileName: *const u16) -> *mut std::ffi::c_void;
        fn GetProcAddress(
            hModule: *mut std::ffi::c_void,
            lpProcName: *const u8,
        ) -> *mut std::ffi::c_void;
        fn FreeLibrary(hLibModule: *mut std::ffi::c_void) -> i32;
    }

    #[link(name = "shell32")]
    extern "system" {
        fn ShellExecuteW(
            hwnd: *mut std::ffi::c_void,
            lpOperation: *const u16,
            lpFile: *const u16,
            lpParameters: *const u16,
            lpDirectory: *const u16,
            nShowCmd: i32,
        ) -> *mut std::ffi::c_void;
    }

    #[repr(C)]
    #[allow(non_snake_case)]
    struct OSVERSIONINFOEXW {
        dwOSVersionInfoSize: u32,
        dwMajorVersion: u32,
        dwMinorVersion: u32,
        dwBuildNumber: u32,
        dwPlatformId: u32,
        szCSDVersion: [u16; 128],
        wServicePackMajor: u16,
        wServicePackMinor: u16,
        wSuiteMask: u16,
        wProductType: u8,
        wReserved: u8,
    }

    type RtlGetVersionFn = unsafe extern "system" fn(*mut OSVERSIONINFOEXW) -> i32;

    pub fn get_os_version() -> Option<(u32, u32, u32)> {
        unsafe {
            let ntdll_name: Vec<u16> = OsStr::new("ntdll.dll\0").encode_wide().collect();
            let ntdll = LoadLibraryW(ntdll_name.as_ptr());
            if ntdll.is_null() {
                return None;
            }
            let proc = GetProcAddress(ntdll, b"RtlGetVersion\0".as_ptr());
            if proc.is_null() {
                FreeLibrary(ntdll);
                return None;
            }
            let rtl_get_version: RtlGetVersionFn = std::mem::transmute(proc);

            let mut info: OSVERSIONINFOEXW = std::mem::zeroed();
            info.dwOSVersionInfoSize = std::mem::size_of::<OSVERSIONINFOEXW>() as u32;

            let status = rtl_get_version(&mut info);
            FreeLibrary(ntdll);

            if status == 0 {
                Some((info.dwMajorVersion, info.dwMinorVersion, info.dwBuildNumber))
            } else {
                None
            }
        }
    }

    pub fn open_windows_11_website() {
        let url_wide: Vec<u16> = OsStr::new("https://www.microsoft.com/zh-cn/windows/get-windows-11\0")
            .encode_wide()
            .collect();
        let op_wide: Vec<u16> = OsStr::new("open\0").encode_wide().collect();

        unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                op_wide.as_ptr(),
                url_wide.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                1, // SW_SHOWNORMAL
            );
        }
    }

    pub fn show_system_unsupported_dialog(current_build: u32) {
        let title = "Ruvo - 系统版本不受支持 (建议升级至 Windows 11)\0";
        let message = format!(
            "抱歉，您的操作系统版本不满足 Ruvo 的最低运行要求。\n\n\
            【当前系统检测信息】\n\
            检测到当前 Windows 内部版本号为：Build {}\n\n\
            【最低系统配置要求】\n\
            • 操作系统：Windows 10 64位（版本 1809 / 内部版本号 17763）或更高，强烈推荐升级至 Windows 11\n\
            • 运行时环境：Microsoft Edge WebView2 Runtime（系统内置或可在微软官网免费下载）\n\
            • 处理器架构：x64 (64位) 或 ARM64 处理器\n\
            • 内存要求：建议 4GB 及以上（最低 2GB）\n\
            • 视窗动效支持：DirectX 11 / DirectComposition 硬件加速合成\n\n\
            【升级建议】\n\
            推荐将操作系统升级至 Windows 11，以享受全功能的四周平滑圆角、原生贴靠布局与流畅的双链笔记编辑体验。\n\n\
            是否立即打开浏览器前往 Windows 11 官方网站获取升级支持？\n\
            （点击【是】前往官网，点击【否】直接退出）\n\0",
            current_build
        );

        let title_wide: Vec<u16> = OsStr::new(title).encode_wide().collect();
        let message_wide: Vec<u16> = OsStr::new(&message).encode_wide().collect();

        const MB_YESNO: u32 = 0x00000004;
        const MB_ICONERROR: u32 = 0x00000010;
        const MB_TOPMOST: u32 = 0x00040000;
        const IDYES: i32 = 6;

        let ret = unsafe {
            MessageBoxW(
                std::ptr::null_mut(),
                message_wide.as_ptr(),
                title_wide.as_ptr(),
                MB_YESNO | MB_ICONERROR | MB_TOPMOST,
            )
        };

        if ret == IDYES {
            open_windows_11_website();
            // 稍作缓冲等待默认浏览器调起
            std::thread::sleep(std::time::Duration::from_millis(300));
        }
    }
}

/// Checks whether the current operating system meets Ruvo's minimum requirements.
/// If not, immediately pops up a native OS modal dialog with a jump button to the Windows 11 website,
/// and then terminates the process.
pub fn check_system_requirements() {
    #[cfg(target_os = "windows")]
    {
        if let Some((major, _minor, build)) = windows_impl::get_os_version() {
            // Windows 10 is major version 10.
            // Minimum build is 17763 (Windows 10 Version 1809, October 2018 Update).
            // Windows 11 is major 10 and build >= 22000.
            let is_supported = major > 10 || (major == 10 && build >= 17763);
            if !is_supported {
                windows_impl::show_system_unsupported_dialog(build);
                std::process::exit(1);
            }
        }
    }
}

#[tauri::command]
pub fn open_windows_11_website() {
    #[cfg(target_os = "windows")]
    {
        windows_impl::open_windows_11_website();
    }
    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        let _ = Command::new("open")
            .arg("https://www.microsoft.com/zh-cn/windows/get-windows-11")
            .spawn();
    }
}

#[derive(serde::Serialize)]
pub struct SystemRequirementsInfo {
    pub is_supported: bool,
    pub os_name: String,
    pub os_version: String,
    pub build_number: u32,
    pub min_required_os: String,
    pub min_required_build: u32,
    pub webview2_required: bool,
    pub min_ram_gb: u32,
    pub rec_ram_gb: u32,
}

#[tauri::command]
pub fn get_system_requirements_info() -> SystemRequirementsInfo {
    #[cfg(target_os = "windows")]
    {
        let (major, minor, build) = windows_impl::get_os_version().unwrap_or((10, 0, 19045));
        let is_win11 = major >= 10 && build >= 22000;
        let os_name = if is_win11 {
            "Windows 11"
        } else if major >= 10 {
            "Windows 10"
        } else {
            "Windows (Legacy)"
        };

        let is_supported = major > 10 || (major == 10 && build >= 17763);

        SystemRequirementsInfo {
            is_supported,
            os_name: os_name.to_string(),
            os_version: format!("{}.{}.{}", major, minor, build),
            build_number: build,
            min_required_os: "Windows 10 64位 (1809 / Build 17763+) 或 Windows 11".to_string(),
            min_required_build: 17763,
            webview2_required: true,
            min_ram_gb: 2,
            rec_ram_gb: 4,
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        SystemRequirementsInfo {
            is_supported: true,
            os_name: std::env::consts::OS.to_string(),
            os_version: "Standard".to_string(),
            build_number: 0,
            min_required_os: "Standard supported desktop platform".to_string(),
            min_required_build: 0,
            webview2_required: false,
            min_ram_gb: 2,
            rec_ram_gb: 4,
        }
    }
}

