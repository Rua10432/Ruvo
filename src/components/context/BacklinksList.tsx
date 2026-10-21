import type { Backlink } from "../../types";
import BacklinkCard from "./BacklinkCard";

type BacklinksListProps = {
  backlinks: Backlink[];
  selectedId: string | null;
  onSelect: (link: Backlink) => void;
};

export default function BacklinksList({
  backlinks,
  selectedId,
  onSelect,
}: BacklinksListProps) {
  return (
    <section className="backlinks-container" aria-label="反向链接列表">
      {backlinks.length > 0 ? (
        <>
          <div className="backlinks-summary">
            <mdui-badge className="backlinks-badge">{String(backlinks.length)}</mdui-badge>
            <span>篇笔记引用了当前文档</span>
          </div>
          <div className="backlinks-list">
            {backlinks.map((link) => (
              <BacklinkCard
                key={link.id}
                link={link}
                isSelected={selectedId === link.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="context-empty">暂无反向链接</p>
      )}
    </section>
  );
}
