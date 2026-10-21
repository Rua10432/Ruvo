import { useState, useEffect, useCallback } from "react";
import {
  Palette,
  Type,
  Keyboard,
  HardDrive,
  Info,
  Check,
  RotateCcw,
} from "lucide-react";
import { useRuvoSettings } from "./settingsStore";
import { AppearanceTab, EditorTab, StorageTab, ShortcutsTab, AboutTab } from "./tabs";
import { TitleBar } from "../layout/TitleBar";
import WindowResizeHandles from "../layout/WindowResizeHandles";
import "./SettingsApp.css";

export type SettingsTab = "appearance" | "editor" | "shortcuts" | "storage" | "about";

export interface SettingsAppProps {
  onClose?: () => void;
  initialTab?: SettingsTab;
}

const TAB_CONFIG: Record<SettingsTab, { title: string; subtitle: string }> = {
  appearance: {
    title: "外观与显示",
    subtitle: "配置界面视觉动效与交互过渡体验",
  },
  editor: {
    title: "编辑器设置",
    subtitle: "定制您的正文字体大小、行高、排版与自动保存策略",
  },
  shortcuts: {
    title: "快捷键设置",
    subtitle: "自定义全局导航与 Markdown 丰富排版的键盘快捷键绑定，提升双链输入效率",
  },
  storage: {
    title: "存储与知识库",
    subtitle: "透明管理本地磁盘存储目录，体验零私有格式锁定的原生 Markdown 文件体系",
  },
  about: {
    title: "关于 Ruvo",
    subtitle: "极简、便携、双链驱动的第二大脑 · 技术规格与开源授权",
  },
};

export default function SettingsApp({ onClose, initialTab = "appearance" }: SettingsAppProps) {
  const { settings, resetSettings } = useRuvoSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2400);
  }, []);

  const handleClose = useCallback(async () => {
    if (onClose) {
      onClose();
      return;
    }
    try {
      if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("close_settings_window");
        return;
      }
    } catch {
      // ignore
    }
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      await win.close();
    } catch {
      if (typeof window !== "undefined") {
        window.close();
      }
    }
  }, [onClose]);

  // Support closing with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  const handleResetDefaults = useCallback(() => {
    resetSettings();
    showToast("设置已恢复为初始默认值");
  }, [resetSettings, showToast]);

  return (
    <div
      className={`settings-window ${isMaximized ? "is-maximized" : ""}`}
      data-theme={settings.theme}
    >
      {!onClose && <WindowResizeHandles isMaximized={isMaximized} />}
      <TitleBar
        title="Ruvo"
        subtitle="系统偏好设置"
        onClose={handleClose}
        onMaximizedChange={setIsMaximized}
      />

      {/* 主体分栏：左侧导航 + 右侧内容 */}
      <div className="settings-body">
        {/* 左侧导航栏 */}
        <aside className="settings-sidebar" aria-label="设置导航">
          <nav className="settings-nav-list" role="tablist">
            <mdui-list-item
              rounded
              active={activeTab === "appearance" ? true : undefined}
              className={`settings-nav-item ${activeTab === "appearance" ? "is-active" : ""}`}
              onClick={() => setActiveTab("appearance")}
            >
              <Palette size={18} slot="icon" />
              外观与显示
            </mdui-list-item>

            <mdui-list-item
              rounded
              active={activeTab === "editor" ? true : undefined}
              className={`settings-nav-item ${activeTab === "editor" ? "is-active" : ""}`}
              onClick={() => setActiveTab("editor")}
            >
              <Type size={18} slot="icon" />
              编辑器设置
            </mdui-list-item>

            <mdui-list-item
              rounded
              active={activeTab === "shortcuts" ? true : undefined}
              className={`settings-nav-item ${activeTab === "shortcuts" ? "is-active" : ""}`}
              onClick={() => setActiveTab("shortcuts")}
            >
              <Keyboard size={18} slot="icon" />
              快捷键设置
            </mdui-list-item>

            <mdui-list-item
              rounded
              active={activeTab === "storage" ? true : undefined}
              className={`settings-nav-item ${activeTab === "storage" ? "is-active" : ""}`}
              onClick={() => setActiveTab("storage")}
            >
              <HardDrive size={18} slot="icon" />
              存储与知识库
            </mdui-list-item>

            <mdui-list-item
              rounded
              active={activeTab === "about" ? true : undefined}
              className={`settings-nav-item ${activeTab === "about" ? "is-active" : ""}`}
              onClick={() => setActiveTab("about")}
            >
              <Info size={18} slot="icon" />
              关于 Ruvo
            </mdui-list-item>
          </nav>

          <div className="settings-sidebar-footer">
            <mdui-button
              variant="text"
              className="settings-reset-btn"
              onClick={handleResetDefaults}
              title="恢复默认配置"
            >
              <RotateCcw size={14} slot="icon" />
              恢复默认设置
            </mdui-button>
          </div>
        </aside>

        {/* 右侧主面板：固定顶部 Header + 独立滚动区域 */}
        <section className="settings-main-container" role="tabpanel">
          <header className="settings-page-header">
            <h2 className="settings-page-title">{TAB_CONFIG[activeTab].title}</h2>
            <p className="settings-page-subtitle">{TAB_CONFIG[activeTab].subtitle}</p>
          </header>

          <main className="settings-content-pane">
            {activeTab === "appearance" && <AppearanceTab onShowToast={showToast} />}
            {activeTab === "editor" && <EditorTab onShowToast={showToast} />}
            {activeTab === "shortcuts" && <ShortcutsTab onShowToast={showToast} />}
            {activeTab === "storage" && <StorageTab onShowToast={showToast} />}
            {activeTab === "about" && <AboutTab />}
          </main>
        </section>
      </div>

      {/* 轻量吐司提示 */}
      {toastMessage && (
        <div className="settings-toast" role="status">
          <Check size={14} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
