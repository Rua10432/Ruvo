import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { fileStore, fileStoreError } from "../../services/fileStore";
import {
  broadcastRestoreToFileBar,
  subscribeAppClosing,
  subscribeNoteChange,
} from "../../services/noteSync";
import { isSameId } from "../../hooks/useNoteTabs";
import { applyTheme, getSavedTheme } from "../../utils/theme";
import { applyEditorCssVariables, getSettings } from "../settings/settingsStore";
import TitleBar, { WindowDockToFileBarIcon } from "../layout/TitleBar";
import "./StickyNoteApp.css";

marked.use({
  gfm: true,
  breaks: true,
});

const getGlobalStickyPath = (): string =>
  typeof window !== "undefined"
    ? ((window as any).__RUVO_STICKY_PATH__ ?? (window as any).__RUAM_STICKY_PATH__ ?? "")
    : "";

const getGlobalStickyTitle = (): string =>
  typeof window !== "undefined"
    ? ((window as any).__RUVO_STICKY_TITLE__ ?? (window as any).__RUAM_STICKY_TITLE__ ?? "")
    : "";

export default function StickyNoteApp() {
  const [notePath, setNotePath] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const globalPath = getGlobalStickyPath();
      if (globalPath) return globalPath;
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get("path") || "";
    }
    return "";
  });

  const [noteTitle, setNoteTitle] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const globalTitle = getGlobalStickyTitle();
      if (globalTitle) return globalTitle;
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get("title") || "便签";
    }
    return "便签";
  });

  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState<boolean>(true);

  // Initial load
  useEffect(() => {
    const globalPath = getGlobalStickyPath();
    const globalTitle = getGlobalStickyTitle();
    const effectivePath = notePath || globalPath;
    if (!notePath) {
      if (globalPath) setNotePath(globalPath);
      if (globalTitle) setNoteTitle(globalTitle);
    }
    if (effectivePath) {
      try {
        const savedPin =
          localStorage.getItem(`ruvo_sticky_pinned_${effectivePath}`) ??
          localStorage.getItem(`ruam_sticky_pinned_${effectivePath}`);
        if (savedPin !== null) {
          setIsPinned(savedPin === "true");
        }
      } catch {
        // ignore
      }
    }
  }, [notePath]);

  // Set always-on-top whenever isPinned changes
  useEffect(() => {
    fileStore.setWindowAlwaysOnTop(isPinned).catch(() => {});
    try {
      getCurrentWindow().setAlwaysOnTop(isPinned).catch(() => {});
    } catch {
      // ignore
    }
  }, [isPinned]);

  const handleTogglePin = async () => {
    const next = !isPinned;
    setIsPinned(next);
    const targetPath = notePath || getGlobalStickyPath();
    if (targetPath) {
      try {
        localStorage.setItem(`ruvo_sticky_pinned_${targetPath}`, String(next));
      } catch {
        // ignore
      }
    }
    try {
      await fileStore.setWindowAlwaysOnTop(next);
    } catch (err) {
      console.warn("fileStore.setWindowAlwaysOnTop failed, trying getCurrentWindow():", err);
      try {
        await getCurrentWindow().setAlwaysOnTop(next);
      } catch (e) {
        console.error("设置置顶失败:", e);
      }
    }
  };

  // Close sticky note when main window closes
  useEffect(() => {
    const unsubscribe = subscribeAppClosing(() => {
      try {
        getCurrentWindow().close().catch(() => {
          window.close();
        });
      } catch {
        window.close();
      }
    });
    return unsubscribe;
  }, []);

  // Read note file
  useEffect(() => {
    if (!notePath) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fileStore
      .readNote(notePath)
      .then((data) => {
        if (isMounted) {
          setContent(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(fileStoreError(err));
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [notePath]);

  // Subscribe to real-time sync from other windows (e.g. main editor)
  useEffect(() => {
    if (!notePath) return;
    const unsubscribe = subscribeNoteChange((changedPath, newContent) => {
      if (isSameId(changedPath, notePath)) {
        setContent(newContent);
      }
    });
    return unsubscribe;
  }, [notePath]);

  // Apply theme and editor CSS variables
  useEffect(() => {
    applyTheme(getSavedTheme());
    applyEditorCssVariables(getSettings());
  }, []);

  const handleDockToFileBar = async () => {
    const effectivePath = notePath || getGlobalStickyPath();
    const effectiveTitle = noteTitle || getGlobalStickyTitle() || "便签";
    broadcastRestoreToFileBar(effectivePath, effectiveTitle);
    try {
      await getCurrentWindow().close();
    } catch {
      window.close();
    }
  };

  const cleanTitle = noteTitle.replace(/\.md$/i, "");
  const renderedHtml = DOMPurify.sanitize(
    marked.parse(content || "*（便签为空）*") as string
  );

  return (
    <div className="sticky-note-app">
      {/* 统一窗口标题栏 (含置顶切换，无最大化按钮，关闭按钮替换为插入到文件栏) */}
      <TitleBar
        title="Ruvo"
        subtitle={cleanTitle}
        showBreadcrumb={false}
        showMaximize={false}
        showPin={true}
        isPinned={isPinned}
        onTogglePin={handleTogglePin}
        closeButtonTitle="插入到文件栏"
        closeButtonIcon={<WindowDockToFileBarIcon />}
        closeButtonClass="dock-filebar"
        onClose={handleDockToFileBar}
      />

      {/* 便签主体 (纯净轻量只读预览) */}
      <main className="sticky-note-body">
        {loading && (
          <div className="sticky-note-loading">
            <span>加载中...</span>
          </div>
        )}

        {error && (
          <div className="sticky-note-error">
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && (
          <div
            className="sticky-note-preview"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        )}
      </main>
    </div>
  );
}
