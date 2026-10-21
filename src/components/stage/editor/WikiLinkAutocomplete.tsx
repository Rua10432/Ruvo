import { useEffect, useRef } from "react";
import { FileText, Plus } from "lucide-react";
import type { WikiLinkSuggestion } from "../../../utils/wikiLinkPlugin";
import "./WikiLink.css";

export interface WikiLinkAutocompleteProps {
  open: boolean;
  query: string;
  position: { top: number; left: number };
  suggestions: WikiLinkSuggestion[];
  selectedIndex: number;
  onSelect: (suggestion: WikiLinkSuggestion) => void;
  onHoverIndex?: (index: number) => void;
}

export default function WikiLinkAutocomplete({
  open,
  query,
  position,
  suggestions,
  selectedIndex,
  onSelect,
  onHoverIndex,
}: WikiLinkAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (!open || !containerRef.current) return;
    const selectedEl = containerRef.current.querySelector(
      `.wikilink-suggestion-item[data-index="${selectedIndex}"]`
    );
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }, [open, selectedIndex]);

  if (!open || suggestions.length === 0) return null;

  // Helper to render matched query in bold
  const renderHighlightedTitle = (title: string, highlight: string) => {
    if (!highlight) return title;
    const lowerTitle = title.toLowerCase();
    const lowerHighlight = highlight.toLowerCase();
    const idx = lowerTitle.indexOf(lowerHighlight);
    if (idx === -1) return title;

    const before = title.slice(0, idx);
    const match = title.slice(idx, idx + highlight.length);
    const after = title.slice(idx + highlight.length);

    return (
      <>
        {before}
        <span className="wikilink-suggestion-match">{match}</span>
        {after}
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      className="wikilink-autocomplete"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      onMouseDown={(e) => {
        // Prevent contentEditable from losing focus on mousedown
        e.preventDefault();
      }}
    >
      <div className="wikilink-autocomplete-header">
        <span>双链笔记联想</span>
        <span className="shortcut-hint">↑↓ 选择 · Enter / Tab 补全</span>
      </div>

      <div className="wikilink-suggestions-list" role="listbox">
        {suggestions.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <div
              key={item.id}
              role="option"
              aria-selected={isSelected}
              data-index={index}
              className={`wikilink-suggestion-item ${isSelected ? "is-selected" : ""}`}
              onClick={() => onSelect(item)}
              onMouseEnter={() => onHoverIndex?.(index)}
            >
              <div className="wikilink-suggestion-main">
                {item.isCreateNew ? (
                  <>
                    <Plus size={14} className="wikilink-suggestion-create" />
                    <span className="wikilink-suggestion-title wikilink-suggestion-create">
                      创建新笔记: “{item.title}”
                    </span>
                  </>
                ) : (
                  <>
                    <FileText size={14} />
                    <span className="wikilink-suggestion-title">
                      {renderHighlightedTitle(item.title, query)}
                    </span>
                  </>
                )}
              </div>

              {!item.isCreateNew && item.notebookName && (
                <span className="wikilink-suggestion-badge">{item.notebookName}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
