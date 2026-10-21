import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Pin, PinOff } from "lucide-react";
// Windows 10 / 11 & Chrome Native Caption Icons (Pixel-perfect Windows standard)
function WindowMinimizeIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
    >
      {/* 最小化：长 10px、宽 1px 的居中线段 */}
      <path
        d="M 0,5 L 10,5"
        stroke="currentColor"
        strokeWidth="1"
        shapeRendering="crispEdges"
      />
    </svg>
  );
}

function WindowMaximizeIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
    >
      {/* Chrome / Windows 原生规范：10x10 直角线框，底边位于 y=9.5 与最小化对齐 */}
      <rect
        x="0.5"
        y="0.5"
        width="9"
        height="9"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        shapeRendering="crispEdges"
      />
    </svg>
  );
}

function WindowRestoreIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
    >
      {/* 后方方框右上角：直角双框 */}
      <path
        d="M 2.5,2.5 L 2.5,0.5 L 9.5,0.5 L 9.5,7.5 L 7.5,7.5"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        shapeRendering="crispEdges"
      />
      {/* 前方方框 */}
      <rect
        x="0.5"
        y="2.5"
        width="7"
        height="7"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        shapeRendering="crispEdges"
      />
    </svg>
  );
}

function WindowCloseIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
    >
      {/* 斜线不使用 crispEdges，保留平滑矢量抗锯齿，与 Chrome 完全一致 */}
      <path
        d="M 0.5,0.5 L 9.5,9.5 M 9.5,0.5 L 0.5,9.5"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

// 插入到文件栏图标：Windows 10/11 Caption 像素级标准 (底部文件栏水平横线 + 向下的居中插入箭头)
export function WindowDockToFileBarIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
    >
      {/* 底部横线：代表主窗口文件/标签栏 (y=8.5, strokeWidth=1, crispEdges) */}
      <path
        d="M 0,8.5 L 10,8.5"
        stroke="currentColor"
        strokeWidth="1"
        shapeRendering="crispEdges"
      />
      {/* 向下的插入箭头：垂直杆 (x=5, y=0.5 到 y=6.5) */}
      <path
        d="M 5,0.5 L 5,6.5"
        stroke="currentColor"
        strokeWidth="1"
        shapeRendering="crispEdges"
      />
      {/* 箭头两翼 (折线尖端位于 (5, 6.5)) */}
      <path
        d="M 2.5,4 L 5,6.5 L 7.5,4"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

import "./TitleBar.css";

export interface TitleBarProps {
  title?: string;
  subtitle?: string;
  activeNotebookName?: string;
  activeNoteName?: string | null;
  isDirty?: boolean;
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  onMaximizedChange?: (isMaximized: boolean) => void;
  onClose?: () => void;
  showBreadcrumb?: boolean;
  showMaximize?: boolean;
  closeButtonTitle?: string;
  closeButtonIcon?: React.ReactNode;
  closeButtonClass?: string;
  showPin?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  extraControls?: React.ReactNode;
}

export function TitleBar({
  title = "Ruvo",
  subtitle,
  activeNotebookName,
  activeNoteName,
  isDirty = false,
  onOpenSearch: _onOpenSearch,
  onOpenSettings: _onOpenSettings,
  onMaximizedChange,
  onClose,
  showBreadcrumb = true,
  showMaximize = true,
  closeButtonTitle,
  closeButtonIcon,
  closeButtonClass,
  showPin = false,
  isPinned = false,
  onTogglePin,
  extraControls,
}: TitleBarProps) {
  const isTauri =
    typeof window !== "undefined" &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

  const [isMaximized, setIsMaximized] = useState(false);
  const [isMaximizeHovered, setIsMaximizeHovered] = useState(false);
  const onMaximizedChangeRef = useRef(onMaximizedChange);

  useEffect(() => {
    onMaximizedChangeRef.current = onMaximizedChange;
  }, [onMaximizedChange]);

  // Sync window maximized state and listen to resize & snap hover in Tauri
  useEffect(() => {
    if (!isTauri) return;

    let isMounted = true;
    let unlistenResize: (() => void) | undefined;
    let unlistenSnapEnter: (() => void) | undefined;
    let unlistenSnapLeave: (() => void) | undefined;

    const updateMaximized = async () => {
      try {
        const appWindow = getCurrentWindow();
        const maximized = await appWindow.isMaximized();
        if (isMounted) {
          setIsMaximized(maximized);
          onMaximizedChangeRef.current?.(maximized);
        }
      } catch {
        try {
          const maximized = await invoke<boolean>("is_window_maximized");
          if (isMounted) {
            setIsMaximized(maximized);
            onMaximizedChangeRef.current?.(maximized);
          }
        } catch {
          // ignore fallback error
        }
      }
    };

    void updateMaximized();

    try {
      const appWindow = getCurrentWindow();
      appWindow
        .onResized(async () => {
          if (isMounted) {
            await updateMaximized();
          }
        })
        .then((unlisten) => {
          if (isMounted) {
            unlistenResize = unlisten;
          } else {
            unlisten();
          }
        })
        .catch(() => {});

      // Windows 11 Snap Layouts hover event bridge
      appWindow
        .listen("tauri-snap://snap/mouseenter", () => {
          if (isMounted) {
            setIsMaximizeHovered(true);
          }
        })
        .then((unlisten) => {
          if (isMounted) unlistenSnapEnter = unlisten;
          else unlisten();
        })
        .catch(() => {});

      appWindow
        .listen("tauri-snap://snap/mouseleave", () => {
          if (isMounted) {
            setIsMaximizeHovered(false);
          }
        })
        .then((unlisten) => {
          if (isMounted) unlistenSnapLeave = unlisten;
          else unlisten();
        })
        .catch(() => {});
    } catch {
      // ignore
    }

    const handleWindowResize = () => {
      void updateMaximized();
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      isMounted = false;
      if (unlistenResize) {
        unlistenResize();
      }
      if (unlistenSnapEnter) {
        unlistenSnapEnter();
      }
      if (unlistenSnapLeave) {
        unlistenSnapLeave();
      }
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [isTauri]);

  const handleMinimize = useCallback(async () => {
    if (!isTauri) return;
    try {
      await getCurrentWindow().minimize();
    } catch {
      try {
        await invoke("minimize_window");
      } catch (err) {
        console.warn("Failed to minimize window:", err);
      }
    }
  }, [isTauri]);

  const handleToggleMaximize = useCallback(async () => {
    if (!isTauri) return;
    try {
      const appWindow = getCurrentWindow();
      await appWindow.toggleMaximize();
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
      onMaximizedChangeRef.current?.(maximized);
      setTimeout(async () => {
        try {
          const next = await appWindow.isMaximized();
          setIsMaximized(next);
          onMaximizedChangeRef.current?.(next);
        } catch {}
      }, 60);
      setTimeout(async () => {
        try {
          const next = await appWindow.isMaximized();
          setIsMaximized(next);
          onMaximizedChangeRef.current?.(next);
        } catch {}
      }, 180);
    } catch {
      try {
        await invoke("toggle_maximize_window");
        const maximized = await invoke<boolean>("is_window_maximized");
        setIsMaximized(maximized);
        onMaximizedChangeRef.current?.(maximized);
        setTimeout(async () => {
          try {
            const next = await invoke<boolean>("is_window_maximized");
            setIsMaximized(next);
            onMaximizedChangeRef.current?.(next);
          } catch {}
        }, 60);
        setTimeout(async () => {
          try {
            const next = await invoke<boolean>("is_window_maximized");
            setIsMaximized(next);
            onMaximizedChangeRef.current?.(next);
          } catch {}
        }, 180);
      } catch (err) {
        console.warn("Failed to toggle maximize:", err);
      }
    }
  }, [isTauri]);

  const handleClose = useCallback(async () => {
    if (onClose) {
      onClose();
      return;
    }
    if (!isTauri) return;
    try {
      await getCurrentWindow().close();
    } catch {
      try {
        await invoke("close_window");
      } catch (err) {
        console.warn("Failed to close window:", err);
      }
    }
  }, [isTauri, onClose]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!showMaximize) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("button, a, input, select, textarea, [data-no-drag]")) {
        return;
      }
      void handleToggleMaximize();
    },
    [handleToggleMaximize, showMaximize]
  );

  return (
    <header
      className={`custom-titlebar ${isMaximized ? "is-maximized" : ""}`}
      data-tauri-drag-region
      onDoubleClick={handleDoubleClick}
      aria-label="窗口标题栏"
    >
      {/* Left section: App Branding & Breadcrumb */}
      <div className="titlebar-left" data-tauri-drag-region>
        <div className="titlebar-branding" data-tauri-drag-region title={title}>
          <span className="titlebar-logo-mark" aria-hidden="true" data-tauri-drag-region>
            <img src="/app-icon.png" alt="Ruvo" className="titlebar-logo-img" data-tauri-drag-region />
          </span>
          <span className="titlebar-app-name" data-tauri-drag-region>
            {title}
          </span>
        </div>

        {subtitle && (
          <>
            <div className="titlebar-divider" aria-hidden="true" data-tauri-drag-region />
            <span className="titlebar-subtitle" data-tauri-drag-region title={subtitle}>
              {subtitle}
            </span>
          </>
        )}

        {showBreadcrumb && (activeNotebookName || activeNoteName) && (
          <>
            <div className="titlebar-divider" aria-hidden="true" data-tauri-drag-region />
            <div className="titlebar-breadcrumb" data-tauri-drag-region>
              {activeNotebookName && (
                <span
                  className="titlebar-breadcrumb-notebook"
                  title={activeNotebookName}
                  data-tauri-drag-region
                >
                  {activeNotebookName}
                </span>
              )}
              {activeNotebookName && activeNoteName && (
                <span className="titlebar-breadcrumb-sep" aria-hidden="true" data-tauri-drag-region>
                  /
                </span>
              )}
              {activeNoteName && (
                <span
                  className="titlebar-breadcrumb-note"
                  title={activeNoteName}
                  data-tauri-drag-region
                >
                  {activeNoteName}
                </span>
              )}
              {isDirty && (
                <span
                  className="titlebar-dirty-dot"
                  title="未保存的更改"
                  aria-label="未保存"
                  data-tauri-drag-region
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Center section: Draggable Window Region */}
      <div className="titlebar-center" data-tauri-drag-region />

      {/* Right section: Window Controls or Web Fallback */}
      <div className="titlebar-right" data-tauri-drag-region>
        {extraControls}
        {showPin && (
          <button
            type="button"
            className={`window-ctrl-btn pin ${isPinned ? "is-pinned" : ""}`}
            onClick={onTogglePin}
            onDoubleClick={(e) => e.stopPropagation()}
            title={isPinned ? "取消置顶 (当前始终置顶)" : "窗口置顶"}
            aria-label={isPinned ? "取消置顶" : "窗口置顶"}
            data-tauri-drag-region="false"
          >
            {isPinned ? <Pin size={12} /> : <PinOff size={12} />}
          </button>
        )}
        {isTauri ? (
          <>
            <button
              type="button"
              className="window-ctrl-btn minimize"
              onClick={handleMinimize}
              onDoubleClick={(e) => e.stopPropagation()}
              title="最小化"
              aria-label="最小化"
              data-tauri-drag-region="false"
            >
              <WindowMinimizeIcon />
            </button>
            {showMaximize && (
              <button
                id="titlebar-maximize"
                type="button"
                className={`window-ctrl-btn maximize ${isMaximized ? "is-maximized" : ""} ${
                  isMaximizeHovered ? "is-hovered" : ""
                }`}
                onMouseEnter={() => setIsMaximizeHovered(true)}
                onMouseLeave={() => setIsMaximizeHovered(false)}
                onClick={handleToggleMaximize}
                onDoubleClick={(e) => e.stopPropagation()}
                title={isMaximized ? "向下还原" : "最大化"}
                aria-label={isMaximized ? "向下还原" : "最大化"}
                data-tauri-drag-region="false"
              >
                {isMaximized ? <WindowRestoreIcon /> : <WindowMaximizeIcon />}
              </button>
            )}
            <button
              type="button"
              className={`window-ctrl-btn ${closeButtonClass || "close"}`}
              onClick={handleClose}
              onDoubleClick={(e) => e.stopPropagation()}
              title={closeButtonTitle || "关闭"}
              aria-label={closeButtonTitle || "关闭"}
              data-tauri-drag-region="false"
            >
              {closeButtonIcon || <WindowCloseIcon />}
            </button>
          </>
        ) : (
          <>
            <div className="titlebar-web-indicator" title="当前运行于网页预览模式">
              <span className="titlebar-web-badge">Web</span>
            </div>
            {onClose && (
              <button
                type="button"
                className={`window-ctrl-btn ${closeButtonClass || "close"}`}
                onClick={handleClose}
                onDoubleClick={(e) => e.stopPropagation()}
                title={closeButtonTitle || "关闭"}
                aria-label={closeButtonTitle || "关闭"}
                data-tauri-drag-region="false"
              >
                {closeButtonIcon || <WindowCloseIcon />}
              </button>
            )}
          </>
        )}
      </div>
    </header>
  );
}

export default TitleBar;
