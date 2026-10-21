import { useState } from "react";
import type { Backlink, ContextMode, OutlineItem } from "../../types";

export type { Backlink, OutlineItem };
import RightSidebarHeader from "./RightSidebarHeader";
import ContextModeSwitch from "./ContextModeSwitch";
import OutlineList from "./OutlineList";
import BacklinksList from "./BacklinksList";
import "./RightSidebar.css";

export type RightSidebarProps = {
  onClose?: () => void;
  outlineItems?: OutlineItem[];
  backlinks?: Backlink[];
  activeHeadingId?: string | null;
  onOutlineSelect?: (item: OutlineItem) => void;
  onBacklinkSelect?: (link: Backlink) => void;
};

export default function RightSidebar({
  onClose,
  outlineItems = [],
  backlinks = [],
  activeHeadingId,
  onOutlineSelect,
  onBacklinkSelect,
}: RightSidebarProps) {
  const [mode, setMode] = useState<ContextMode>("outline");
  const [selectedOutlineId, setSelectedOutlineId] = useState<string | null>(null);
  const [selectedBacklinkId, setSelectedBacklinkId] = useState<string | null>(null);

  const effectiveOutlineId = activeHeadingId ?? selectedOutlineId;

  const handleOutlineSelect = (item: OutlineItem) => {
    setSelectedOutlineId(item.id);
    onOutlineSelect?.(item);
  };

  const handleBacklinkSelect = (link: Backlink) => {
    setSelectedBacklinkId(link.id);
    onBacklinkSelect?.(link);
  };

  return (
    <aside className="right-sidebar" aria-label="文档辅助栏">
      <RightSidebarHeader onClose={onClose} />

      <ContextModeSwitch mode={mode} onModeChange={setMode} />

      <div className="right-sidebar-content">
        {mode === "outline" ? (
          <OutlineList
            items={outlineItems}
            selectedId={effectiveOutlineId}
            onSelect={handleOutlineSelect}
          />
        ) : (
          <BacklinksList
            backlinks={backlinks}
            selectedId={selectedBacklinkId}
            onSelect={handleBacklinkSelect}
          />
        )}
      </div>
    </aside>
  );
}
