import { useEffect, useMemo, useState } from "react";
import { ChevronsDown, ChevronsUp } from "lucide-react";
import type { OutlineItem } from "../../types";
import OutlineItemView from "./OutlineItemView";

type OutlineListProps = {
  items: OutlineItem[];
  selectedId: string | null;
  onSelect: (item: OutlineItem) => void;
};

export default function OutlineList({ items, selectedId, onSelect }: OutlineListProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  // 滚动跟随：当正文联动激活某个大纲项时，保证该项在右侧侧边栏视口内
  useEffect(() => {
    if (!selectedId) return;
    const activeEl = document.querySelector<HTMLElement>(".outline-item.is-selected");
    activeEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  // 判定层级关系与折叠显隐：若某项的祖先处于折叠状态，则隐藏该项
  const { visibleList, parentCount } = useMemo(() => {
    const visible: { item: OutlineItem; hasChildren: boolean; isCollapsed: boolean }[] = [];
    const stack: { id: string; level: number }[] = [];
    let parents = 0;

    for (let i = 0; i < items.length; i++) {
      const current = items[i];
      const next = items[i + 1];
      const hasChildren = Boolean(next && next.level > current.level);
      if (hasChildren) parents++;

      // 弹出栈中层级大于等于当前项的元素（非祖先）
      while (stack.length > 0 && stack[stack.length - 1].level >= current.level) {
        stack.pop();
      }

      // 若祖先链中有任意标题处于折叠状态，则隐藏当前标题
      const isHidden = stack.some((ancestor) => collapsedIds.has(ancestor.id));
      if (!isHidden) {
        visible.push({
          item: current,
          hasChildren,
          isCollapsed: collapsedIds.has(current.id),
        });
      }

      stack.push({ id: current.id, level: current.level });
    }

    return { visibleList: visible, parentCount: parents };
  }, [items, collapsedIds]);

  const toggleCollapse = (item: OutlineItem) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  };

  const collapseAll = () => {
    const parentIds = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      if (items[i + 1] && items[i + 1].level > items[i].level) {
        parentIds.add(items[i].id);
      }
    }
    setCollapsedIds(parentIds);
  };

  const expandAll = () => {
    setCollapsedIds(new Set());
  };

  const allCollapsed = parentCount > 0 && collapsedIds.size >= parentCount;

  return (
    <nav className="outline-container" aria-label="文档大纲">
      {items.length > 0 ? (
        <>
          <div className="outline-summary">
            <div className="outline-summary-left">
              <mdui-badge className="outline-badge">{String(items.length)}</mdui-badge>
              <span>个标题</span>
            </div>
            {parentCount > 0 && (
              <div className="outline-actions">
                <mdui-tooltip content={allCollapsed ? "展开全部" : "折叠全部"} placement="bottom">
                  <mdui-button-icon
                    variant="standard"
                    className="outline-action-btn"
                    onClick={allCollapsed ? expandAll : collapseAll}
                    aria-label={allCollapsed ? "展开全部标题" : "折叠全部标题"}
                  >
                    {allCollapsed ? <ChevronsDown size={15} /> : <ChevronsUp size={15} />}
                  </mdui-button-icon>
                </mdui-tooltip>
              </div>
            )}
          </div>

          <mdui-list className="outline-list">
            {visibleList.map(({ item, hasChildren, isCollapsed }) => (
              <OutlineItemView
                key={item.id}
                item={item}
                isSelected={selectedId === item.id}
                hasChildren={hasChildren}
                isCollapsed={isCollapsed}
                onToggleCollapse={toggleCollapse}
                onSelect={onSelect}
              />
            ))}
          </mdui-list>
        </>
      ) : (
        <p className="context-empty">当前文档暂无标题</p>
      )}
    </nav>
  );
}
