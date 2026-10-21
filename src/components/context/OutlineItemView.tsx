import { ChevronDown, ChevronRight } from "lucide-react";
import type { OutlineItem } from "../../types";

type OutlineItemViewProps = {
  item: OutlineItem;
  isSelected: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  onToggleCollapse: (item: OutlineItem) => void;
  onSelect: (item: OutlineItem) => void;
};

export default function OutlineItemView({
  item,
  isSelected,
  hasChildren,
  isCollapsed,
  onToggleCollapse,
  onSelect,
}: OutlineItemViewProps) {
  return (
    <mdui-list-item
      rounded
      active={isSelected ? true : undefined}
      onClick={() => onSelect(item)}
      className={`outline-item outline-level-${item.level} ${isSelected ? "is-selected" : ""}`}
    >
      <span slot="icon" className="outline-marker" aria-hidden="true">
        {hasChildren ? (
          <mdui-button-icon
            className={`outline-toggle-btn ${isCollapsed ? "is-collapsed" : ""}`}
            aria-label={isCollapsed ? "展开子标题" : "折叠子标题"}
            title={isCollapsed ? "展开子标题" : "折叠子标题"}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onToggleCollapse(item);
            }}
          >
            {isCollapsed ? (
              <ChevronRight size={item.level === 1 ? 14 : 12} />
            ) : (
              <ChevronDown size={item.level === 1 ? 14 : 12} />
            )}
          </mdui-button-icon>
        ) : (
          <span className="outline-dot" />
        )}
      </span>
      <span className="outline-label" title={item.label}>
        {item.label}
      </span>
    </mdui-list-item>
  );
}
