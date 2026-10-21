import { ArrowUpRight, FileText } from "lucide-react";
import type { Backlink } from "../../types";

type BacklinkCardProps = {
  link: Backlink;
  isSelected: boolean;
  onSelect: (link: Backlink) => void;
};

export default function BacklinkCard({ link, isSelected, onSelect }: BacklinkCardProps) {
  return (
    <mdui-card
      variant="outlined"
      clickable
      className={`backlink-card ${isSelected ? "is-selected" : ""}`}
      onClick={() => onSelect(link)}
    >
      <div className="backlink-card-heading">
        <FileText size={16} />
        <h3>{link.title}</h3>
        <ArrowUpRight className="backlink-open-icon" size={14} />
      </div>
      <p>{link.excerpt}</p>
      <span className="backlink-meta">{link.meta}</span>
    </mdui-card>
  );
}
