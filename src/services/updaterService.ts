import type { Update, DownloadEvent } from "@tauri-apps/plugin-updater";

export type UpdatePhase =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "ready"
  | "error";

export interface UpdateState {
  phase: UpdatePhase;
  currentVersion: string;
  newVersion?: string;
  releaseDate?: string;
  releaseNotes?: string;
  progress: number; // 0 - 100
  downloadedBytes: number;
  totalBytes: number;
  errorMessage?: string;
  isSimulated?: boolean;
}

const CURRENT_APP_VERSION = "0.1.0";

let cachedState: UpdateState = {
  phase: "idle",
  currentVersion: CURRENT_APP_VERSION,
  progress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
};

let activeUpdateHandle: Update | null = null;
const stateListeners = new Set<(state: UpdateState) => void>();

function setState(updater: Partial<UpdateState> | ((prev: UpdateState) => UpdateState)) {
  if (typeof updater === "function") {
    cachedState = updater(cachedState);
  } else {
    cachedState = { ...cachedState, ...updater };
  }
  for (const listener of stateListeners) {
    try {
      listener(cachedState);
    } catch (err) {
      console.error("[UpdaterService] Listener error:", err);
    }
  }
}

let appVersionPromise: Promise<string> | null = null;

/**
 * 异步获取应用真实版本号（优先从 Tauri 运行时获取，非 Tauri 环境回退至 CURRENT_APP_VERSION）
 */
export async function getAppVersion(): Promise<string> {
  if (appVersionPromise) {
    return appVersionPromise;
  }

  appVersionPromise = (async () => {
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        const version = await getVersion();
        if (version) {
          setState({ currentVersion: version });
          return version;
        }
      } catch {
        return CURRENT_APP_VERSION;
      }
    }
    return CURRENT_APP_VERSION;
  })();

  return appVersionPromise;
}

// 自动在模块载入时预解析应用版本并更新状态
if (typeof window !== "undefined") {
  void getAppVersion().then((version) => {
    if (version && version !== cachedState.currentVersion) {
      setState({ currentVersion: version });
    }
  });
}

export function getUpdateState(): UpdateState {
  return cachedState;
}

export function subscribeUpdateState(listener: (state: UpdateState) => void): () => void {
  stateListeners.add(listener);
  listener(cachedState);
  return () => {
    stateListeners.delete(listener);
  };
}

/**
 * 检查新版本
 * @param manual 是否是用户手动在设置界面点击（手动点击会在无更新时提示已是最新版本）
 */
export async function checkForUpdates(_manual = false): Promise<UpdateState> {
  const isTauri = typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
  const currentVer = await getAppVersion();

  setState({
    phase: "checking",
    currentVersion: currentVer,
    errorMessage: undefined,
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
  });

  if (!isTauri) {
    // 浏览器预览模式兜底提示
    setTimeout(() => {
      setState({
        phase: "up-to-date",
        currentVersion: currentVer,
      });
    }, 600);
    return cachedState;
  }

  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();

    if (update) {
      activeUpdateHandle = update;
      setState({
        phase: "available",
        currentVersion: update.currentVersion || currentVer,
        newVersion: update.version,
        releaseDate: update.date,
        releaseNotes: update.body || "本次更新包含多项稳定性改进与新特性优化。",
        isSimulated: false,
      });
    } else {
      activeUpdateHandle = null;
      setState({
        phase: "up-to-date",
        currentVersion: currentVer,
        isSimulated: false,
      });
    }
  } catch (error: any) {
    console.warn("[UpdaterService] Check update error:", error);
    // 如果是网络连接失败或未配置服务端点
    const errorMsg =
      error?.message || (typeof error === "string" ? error : "检查更新失败，请检查网络连接");
    setState({
      phase: "error",
      currentVersion: currentVer,
      errorMessage: errorMsg,
    });
  }

  return cachedState;
}

/**
 * 执行下载并安装更新
 */
export async function startDownloadAndInstall(): Promise<void> {
  if (cachedState.isSimulated) {
    // 模拟测试模式下载演示
    setState({ phase: "downloading", progress: 0, downloadedBytes: 0, totalBytes: 10485760 });
    let currentPct = 0;
    const interval = setInterval(() => {
      currentPct += 15;
      if (currentPct >= 100) {
        clearInterval(interval);
        setState({
          phase: "ready",
          progress: 100,
          downloadedBytes: 10485760,
          totalBytes: 10485760,
        });
      } else {
        setState({
          phase: "downloading",
          progress: currentPct,
          downloadedBytes: Math.floor((10485760 * currentPct) / 100),
          totalBytes: 10485760,
        });
      }
    }, 200);
    return;
  }

  if (!activeUpdateHandle) {
    throw new Error("当前没有可用更新或更新句柄已失效");
  }

  setState({
    phase: "downloading",
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    errorMessage: undefined,
  });

  try {
    let downloaded = 0;
    let contentLength = 0;

    await activeUpdateHandle.downloadAndInstall((event: DownloadEvent) => {
      switch (event.event) {
        case "Started":
          contentLength = event.data.contentLength || 0;
          setState({
            totalBytes: contentLength,
            downloadedBytes: 0,
            progress: 0,
          });
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          const pct = contentLength > 0 ? Math.min(100, Math.round((downloaded / contentLength) * 100)) : 0;
          setState({
            downloadedBytes: downloaded,
            progress: pct,
          });
          break;
        case "Finished":
          setState({
            phase: "ready",
            progress: 100,
          });
          break;
      }
    });
  } catch (error: any) {
    console.error("[UpdaterService] Download and install error:", error);
    setState({
      phase: "error",
      errorMessage: error?.message || "下载或安装更新失败",
    });
    throw error;
  }
}

/**
 * 本地开发与交互验证模拟更新
 * 方便开发者在不部署服务器/不发布 Release 的情况下完整体验更新流程
 */
export function simulateTestUpdate(mockVersion = "0.2.0"): void {
  activeUpdateHandle = null;
  setState({
    phase: "available",
    currentVersion: cachedState.currentVersion || CURRENT_APP_VERSION,
    newVersion: mockVersion,
    releaseDate: new Date().toISOString(),
    releaseNotes: `### Ruvo v${mockVersion} 测试更新日志\n- ✨ 新增自动更新与断点续传支持\n- 🎨 优化 VS Code 风格分割条抓手与卡片边框\n- ⚡ 提升本地大文件 Markdown 解析性能\n- 🐞 修复多窗口置顶状态同步问题`,
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 10485760,
    isSimulated: true,
  });
}

/**
 * 重置更新状态至空闲
 */
export function resetUpdateState(): void {
  setState({
    phase: "idle",
    errorMessage: undefined,
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    isSimulated: false,
  });
}
