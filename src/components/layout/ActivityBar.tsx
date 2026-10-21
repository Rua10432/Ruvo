import type { MouseEvent } from "react";
import type { ActivityBarTab, ThemeMode } from "../../types";
import { Files, Sun, Moon, Settings } from "lucide-react";
import "./ActivityBar.css";

import { useRuvoSettings } from "../settings/settingsStore";

export interface ActivityBarProps {
  activeTab: ActivityBarTab;
  onSelectTab: (tab: ActivityBarTab) => void;
  theme: ThemeMode;
  onToggleTheme: (e?: MouseEvent<HTMLButtonElement>) => void;
  onOpenSettings?: () => void;
}

export default function ActivityBar({
  activeTab,
  onSelectTab,
  theme,
  onToggleTheme,
  onOpenSettings,
}: ActivityBarProps) {
  const { settings } = useRuvoSettings();
  const toggleLeftShortcut = settings.shortcuts?.toggleLeftSidebar || "Ctrl+B";
  const settingsShortcut = settings.shortcuts?.openSettings || "Ctrl+,";

  return (
    <aside className="activity-bar" aria-label="活动栏">
      {/* 顶部区域：主功能导航 */}
      <div className="activity-bar-top">
        <nav className="activity-bar-nav" aria-label="主功能导航">
          <mdui-tooltip placement="right" content={`笔记 (${toggleLeftShortcut})`}>
            <mdui-button-icon
              variant="standard"
              className={`activity-bar-item ${activeTab === "notes" ? "is-active" : ""}`}
              onClick={() => onSelectTab("notes")}
              aria-label={`笔记 (${toggleLeftShortcut})`}
            >
              <Files size={20} className="activity-bar-icon" />
            </mdui-button-icon>
          </mdui-tooltip>
        </nav>
      </div>

      {/* 底部操作区：设置第一个，主题第二个 */}
      <div className="activity-bar-bottom">
        <mdui-tooltip placement="right" content={`设置 (${settingsShortcut})`}>
          <mdui-button-icon
            variant="standard"
            className="activity-bar-item activity-bar-action"
            onClick={onOpenSettings}
            aria-label={`设置 (${settingsShortcut})`}
          >
            <Settings size={20} className="activity-bar-icon" />
          </mdui-button-icon>
        </mdui-tooltip>

        <mdui-tooltip placement="right" content="切换主题 (Arona / Plana)">
          <mdui-button-icon
            variant="standard"
            className="activity-bar-item activity-bar-action"
            onClick={(e: any) => onToggleTheme(e)}
            aria-label="切换主题 (Arona / Plana)"
          >
            {theme === "plana" ? (
              <Sun size={20} className="activity-bar-icon" />
            ) : (
              <Moon size={20} className="activity-bar-icon" />
            )}
          </mdui-button-icon>
        </mdui-tooltip>
      </div>
    </aside>
  );
}
