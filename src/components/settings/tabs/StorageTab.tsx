import { useState, useEffect, useCallback } from "react";
import { FolderOpen, HardDrive, Copy, ShieldCheck } from "lucide-react";
import { fileStore } from "../../../services/fileStore";
import type { Notebook } from "../../../types";

export interface StorageTabProps {
  onShowToast?: (msg: string) => void;
  appRoot?: string;
  notebooks?: Notebook[];
  isLoadingStorage?: boolean;
}

export default function StorageTab({
  onShowToast,
  appRoot: propAppRoot,
  notebooks: propNotebooks,
  isLoadingStorage: propIsLoading,
}: StorageTabProps) {
  const [internalAppRoot, setInternalAppRoot] = useState<string>("加载中...");
  const [internalNotebooks, setInternalNotebooks] = useState<Notebook[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);

  const isControlled = propAppRoot !== undefined;
  const appRoot = isControlled ? propAppRoot : internalAppRoot;
  const notebooks = isControlled && propNotebooks ? propNotebooks : internalNotebooks;
  const isLoading = isControlled && propIsLoading !== undefined ? propIsLoading : internalLoading;

  useEffect(() => {
    if (isControlled) return;

    let active = true;
    setInternalLoading(true);

    fileStore
      .getAppRoot()
      .then((root) => {
        if (active) setInternalAppRoot(root);
      })
      .catch((_err) => {
        if (active) setInternalAppRoot("Ruvo 默认存储目录 (~/Documents/Ruvo)");
      });

    fileStore
      .listNotebooks()
      .then((list) => {
        if (active) setInternalNotebooks(list || []);
      })
      .catch((_err) => {
        if (active) setInternalNotebooks([]);
      })
      .finally(() => {
        if (active) setInternalLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isControlled]);

  const handleCopyPath = useCallback(async () => {
    if (!appRoot) return;
    try {
      await navigator.clipboard.writeText(appRoot);
      onShowToast?.("知识库路径已复制到剪贴板");
    } catch {
      onShowToast?.("复制失败");
    }
  }, [appRoot, onShowToast]);

  const handleOpenStorageFolder = useCallback(async () => {
    if (!appRoot || appRoot.includes("默认")) {
      onShowToast?.("存储目录暂不可用或为默认占位符");
      return;
    }

    // 1. Try native backend command (reliably opens Windows Explorer / macOS Finder)
    try {
      if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("open_path_in_file_manager", { path: appRoot });
        onShowToast?.("已在文件资源管理器中打开");
        return;
      }
    } catch (err) {
      console.warn("invoke open_path_in_file_manager failed, trying opener plugin:", err);
    }

    // 2. Try opener plugin
    try {
      const { openPath } = await import("@tauri-apps/plugin-opener");
      await openPath(appRoot);
      onShowToast?.("已在系统文件管理器中打开");
      return;
    } catch (_err) {
      // 3. Fallback: copy path to clipboard
      try {
        await navigator.clipboard.writeText(appRoot);
        onShowToast?.("已将知识库路径复制到剪贴板，请手动打开");
      } catch {
        onShowToast?.("无法打开存储路径");
      }
    }
  }, [appRoot, onShowToast]);

  return (
    <div className="settings-tab-panel">
      {/* 存储根路径展示 */}
      <section className="settings-section">
        <h3 className="settings-section-title">
          <FolderOpen size={16} />
          知识库物理存储目录
        </h3>

        <div className="storage-path-container">
          <div className="storage-path-display" title="当前知识库绝对路径">
            {appRoot}
          </div>

          <div className="storage-actions-row">
            <mdui-button
              variant="filled"
              onClick={handleOpenStorageFolder}
            >
              <FolderOpen size={16} slot="icon" />
              在文件资源管理器中打开
            </mdui-button>

            <mdui-button
              variant="outlined"
              onClick={handleCopyPath}
            >
              <Copy size={16} slot="icon" />
              复制路径
            </mdui-button>
          </div>
        </div>
      </section>

      {/* 知识库统计 */}
      <section className="settings-section">
        <h3 className="settings-section-title">
          <HardDrive size={16} />
          知识库状态概览
        </h3>

        <div className="notebook-stats-grid">
          <div className="notebook-stat-card">
            <span className="notebook-stat-number">
              {isLoading ? "..." : notebooks.length}
            </span>
            <span className="notebook-stat-label">已识别的独立笔记本 (Notebooks)</span>
          </div>

          <div className="notebook-stat-card">
            <span className="notebook-stat-number" style={{ fontSize: "1.15rem" }}>
              本地纯文本 (.md)
            </span>
            <span className="notebook-stat-label">纯净文件存储架构，无私有数据库包裹</span>
          </div>
        </div>

        <div className="info-callout" style={{ marginTop: 16 }}>
          <ShieldCheck size={20} className="info-callout-icon" />
          <div>
            <strong>本地文件优先哲学：</strong>
            Ruvo 不使用专有二进制数据库锁定您的笔记。每个笔记本即是磁盘上的一个独立物理文件夹，每篇笔记都是标准的 UTF-8 Markdown 纯文本。您可以随时直接使用 VS Code、Obsidian、Git 或移动硬盘进行协同编辑与版本备份。
          </div>
        </div>
      </section>
    </div>
  );
}
