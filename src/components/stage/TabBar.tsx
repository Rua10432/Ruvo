import { Plus } from "lucide-react";
import type { LocalNote } from "../../types";
import NoteTab from "./NoteTab";
import { useRuvoSettings } from "../settings/settingsStore";

type TabBarProps = {
  tabs: LocalNote[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCreateTab?: () => void;
};

export default function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onCreateTab,
}: TabBarProps) {
  const { settings } = useRuvoSettings();
  const newNoteShortcut = settings.shortcuts?.newNote || "Ctrl+N";

  return (
    <div className="tab-bar" role="tablist" aria-label="已打开的笔记">
      {tabs.map((tab) => (
        <NoteTab
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onSelect={onSelectTab}
          onClose={onCloseTab}
        />
      ))}
      {onCreateTab && (
        <mdui-tooltip content={`新建笔记 (${newNoteShortcut})`} placement="bottom">
          <mdui-button-icon
            className="tab-new-btn"
            onClick={onCreateTab}
            aria-label="新建笔记"
          >
            <Plus size={15} />
          </mdui-button-icon>
        </mdui-tooltip>
      )}
      {tabs.length === 0 && !onCreateTab && <span className="empty-tabs">没有打开的笔记</span>}
    </div>
  );
}
