import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FormatAction, HeadingType } from "./toolbarConfig";
import { HEADING_LABELS, HEADING_OPTIONS } from "./toolbarConfig";

export interface ToolbarHeadingMenuProps {
  currentHeading?: HeadingType | null;
  disabled?: boolean;
  onSelectHeading?: (action: FormatAction) => void;
}

export function ToolbarHeadingMenu({
  currentHeading = null,
  disabled = false,
  onSelectHeading,
}: ToolbarHeadingMenuProps) {
  const dropdownRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const el = dropdownRef.current;
    if (!el) return;
    const handleOpen = () => {
      setIsDropdownOpen(true);
      if (tooltipRef.current) {
        (tooltipRef.current as any).open = false;
      }
    };
    const handleClose = () => {
      setIsDropdownOpen(false);
    };
    el.addEventListener("open", handleOpen);
    el.addEventListener("close", handleClose);
    return () => {
      el.removeEventListener("open", handleOpen);
      el.removeEventListener("close", handleClose);
    };
  }, []);

  const currentHeadingLabel = currentHeading
    ? HEADING_LABELS[currentHeading]
    : "正文";

  const isHeadingActive = Boolean(currentHeading);

  return (
    <mdui-tooltip
      ref={tooltipRef as any}
      content="正文与标题格式"
      placement="bottom"
      disabled={disabled || isDropdownOpen}
    >
      <mdui-dropdown
        placement="bottom-start"
        disabled={disabled}
        ref={dropdownRef as any}
      >
        <mdui-button
          slot="trigger"
          variant="text"
          className={`toolbar-heading-btn ${isHeadingActive ? "is-active" : ""} ${isDropdownOpen ? "is-open" : ""}`}
          disabled={disabled}
          onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
          aria-label="正文与标题格式"
        >
          <span className="toolbar-heading-btn-label">{currentHeadingLabel}</span>
          <ChevronDown size={13} className="toolbar-heading-btn-chevron" />
        </mdui-button>
        <mdui-menu
          className="toolbar-heading-menu"
          dense
          selects="single"
          value={currentHeading || "paragraph"}
        >
        {HEADING_OPTIONS.map((opt) => {
          const isSelected =
            opt.headingKey === null
              ? !isHeadingActive
              : currentHeading === opt.headingKey;
          return (
            <mdui-menu-item
              key={opt.action}
              value={opt.action}
              className={isSelected ? "is-selected is-active" : ""}
              end-text={isSelected ? "✓" : undefined}
              onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
              onClick={() => {
                onSelectHeading?.(opt.action);
                if (dropdownRef.current) {
                  (dropdownRef.current as any).open = false;
                }
              }}
            >
              {opt.label}
            </mdui-menu-item>
          );
        })}
      </mdui-menu>
    </mdui-dropdown>
  </mdui-tooltip>
  );
}

export default ToolbarHeadingMenu;
