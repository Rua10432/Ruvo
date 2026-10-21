import React, { useLayoutEffect, useRef, useState } from "react";
import {
  Check,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import type { LocalNote } from "../../../types";
import {
  type ActiveFormats,
  defaultActiveFormats,
  type FormatAction,
  type ToolbarItemConfig,
  HISTORY_ITEMS,
  BASIC_STYLE_ITEMS,
  LINK_AND_CODE_ITEMS,
  CODE_BLOCK_ITEM,
  LIST_AND_QUOTE_ITEMS,
  MISC_ITEMS,
} from "./toolbarConfig";
import { ToolbarButton, ToolbarConfigButton } from "./ToolbarButton";
import ToolbarHeadingMenu from "./ToolbarHeadingMenu";
import { useRuvoSettings } from "../../settings/settingsStore";

export type StageToolbarProps = {
  activeNote: LocalNote | null;
  wordCount: number;
  isDirty: boolean;
  onSave: () => void;
  onFormat?: (action: FormatAction) => void;
  hasSelection?: boolean;
  activeFormats?: ActiveFormats;
  rightOpen?: boolean;
  onToggleRight?: () => void;
};

export default function StageToolbar({
  activeNote,
  wordCount: _wordCount,
  isDirty,
  onSave,
  onFormat,
  hasSelection: _hasSelection = false,
  activeFormats = defaultActiveFormats,
  rightOpen = false,
  onToggleRight,
}: StageToolbarProps) {
  const { settings } = useRuvoSettings();
  const saveShortcut = settings.shortcuts?.save || "Ctrl+S";
  const toggleRightShortcut = settings.shortcuts?.toggleRightSidebar || "Ctrl+J";
  const disabled = !activeNote;
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return rightOpen ? window.innerWidth * 0.58 : window.innerWidth * 0.85;
    }
    return 600;
  });

  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreCloseTimer = useRef<number | null>(null);

  const handleMoreEnter = () => {
    if (moreCloseTimer.current) {
      clearTimeout(moreCloseTimer.current);
      moreCloseTimer.current = null;
    }
    setIsMoreOpen(true);
  };

  const handleMoreLeave = () => {
    if (moreCloseTimer.current) {
      clearTimeout(moreCloseTimer.current);
    }
    moreCloseTimer.current = window.setTimeout(() => {
      setIsMoreOpen(false);
      moreCloseTimer.current = null;
    }, 250);
  };

  useLayoutEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const updateWidth = () => {
      setContainerWidth(el.getBoundingClientRect().width);
    };
    updateWidth();
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rightOpen]);

  // Responsive breakpoints based on container width:
  // All 15 formatting buttons together require ~560px (+ actions & padding = ~605px).
  // >= 605px: full formatting toolbar with all 15 buttons inline (no folding, no three dots)
  // < 605px: core + links inline (~360px), with the three dots button ALWAYS visible at ~360px (never clipped!)
  // < 420px: very compact, fold links into three dots as well
  const showExtendedInline = containerWidth >= 605;
  const showLinksInline = containerWidth >= 420;

  const hasMoreActive = Boolean(
    (!showLinksInline && (activeFormats.link || activeFormats.code)) ||
    activeFormats.codeBlock ||
    activeFormats.bulletList ||
    activeFormats.numberedList ||
    activeFormats.taskList ||
    activeFormats.quote ||
    activeFormats.strikethrough
  );

  const renderOverflowItem = (item: ToolbarItemConfig) => {
    const isSelected = item.formatKey ? Boolean(activeFormats[item.formatKey]) : false;
    const Icon = item.icon;
    const shortcutId =
      item.action === "code"
        ? "inlineCode"
        : item.action === "code-block"
        ? "codeBlock"
        : item.action === "task-list"
        ? "taskList"
        : item.action === "bullet-list"
        ? "bulletList"
        : item.action === "numbered-list"
        ? "numberedList"
        : item.action;
    const dynamicShortcut = settings.shortcuts?.[shortcutId] || item.shortcut;

    return (
      <mdui-menu-item
        key={item.action}
        className={isSelected ? "is-active" : ""}
        end-text={isSelected ? "✓" : dynamicShortcut || undefined}
        onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
        onClick={() => {
          onFormat?.(item.action);
          setIsMoreOpen(false);
        }}
      >
        <Icon size={16} slot="icon" />
        {item.label}
      </mdui-menu-item>
    );
  };

  return (
    <div className="stage-toolbar" ref={toolbarRef}>
      <div className="toolbar-formatting">
        {HISTORY_ITEMS.map((item) => (
          <ToolbarConfigButton
            key={item.action}
            item={item}
            disabled={disabled}
            onFormat={onFormat}
          />
        ))}

        <span className="toolbar-divider" />

        <ToolbarHeadingMenu
          currentHeading={activeFormats.heading}
          disabled={disabled}
          onSelectHeading={onFormat}
        />

        <span className="toolbar-divider" />

        {BASIC_STYLE_ITEMS.map((item) => (
          <ToolbarConfigButton
            key={item.action}
            item={item}
            activeFormats={activeFormats}
            disabled={disabled}
            onFormat={onFormat}
          />
        ))}

        {showLinksInline && (
          <>
            <span className="toolbar-divider" />
            {LINK_AND_CODE_ITEMS.map((item) => (
              <ToolbarConfigButton
                key={item.action}
                item={item}
                activeFormats={activeFormats}
                disabled={disabled}
                onFormat={onFormat}
              />
            ))}
          </>
        )}

        {showExtendedInline ? (
          <>
            <ToolbarConfigButton
              item={CODE_BLOCK_ITEM}
              activeFormats={activeFormats}
              disabled={disabled}
              onFormat={onFormat}
            />
            <span className="toolbar-divider" />
            {LIST_AND_QUOTE_ITEMS.map((item) => (
              <ToolbarConfigButton
                key={item.action}
                item={item}
                activeFormats={activeFormats}
                disabled={disabled}
                onFormat={onFormat}
              />
            ))}
            <span className="toolbar-divider" />
            {MISC_ITEMS.map((item) => (
              <ToolbarConfigButton
                key={item.action}
                item={item}
                activeFormats={activeFormats}
                disabled={disabled}
                onFormat={onFormat}
              />
            ))}
          </>
        ) : (
          <>
            <span className="toolbar-divider" />
            <mdui-dropdown
              open={isMoreOpen ? true : undefined}
              placement="bottom-start"
              stay-open-on-click
              disabled={disabled}
              onMouseEnter={handleMoreEnter}
              onMouseLeave={handleMoreLeave}
            >
              <mdui-button-icon
                slot="trigger"
                variant="standard"
                className={`toolbar-btn toolbar-more-btn ${hasMoreActive ? "is-active" : ""}`}
                selected={hasMoreActive ? true : undefined}
                disabled={disabled}
                aria-label="更多格式选项"
                title="更多格式"
                onMouseEnter={handleMoreEnter}
                onMouseLeave={handleMoreLeave}
                onClick={() => setIsMoreOpen((v) => !v)}
              >
                <MoreHorizontal size={16} />
              </mdui-button-icon>

              <mdui-menu
                className="toolbar-overflow-menu"
                dense
                onMouseEnter={handleMoreEnter}
                onMouseLeave={handleMoreLeave}
              >
                {!showLinksInline && (
                  <>
                    {LINK_AND_CODE_ITEMS.map(renderOverflowItem)}
                    <mdui-divider />
                  </>
                )}

                {renderOverflowItem(CODE_BLOCK_ITEM)}

                <mdui-divider />

                {LIST_AND_QUOTE_ITEMS.map(renderOverflowItem)}

                <mdui-divider />

                {MISC_ITEMS.map(renderOverflowItem)}
              </mdui-menu>
            </mdui-dropdown>
          </>
        )}
      </div>

      <div className="toolbar-actions">
        {!settings.autoSave && (
          <ToolbarButton
            tooltip={isDirty ? `保存文档 (${saveShortcut})` : "文档已保存"}
            className={`toolbar-save-btn ${isDirty ? "is-dirty" : ""}`}
            disabled={!activeNote}
            icon={Check}
            iconSize={16}
            label="保存文档"
            onClick={() => activeNote && isDirty && onSave()}
          />
        )}

        {onToggleRight && !settings.autoSave && <span className="toolbar-divider" />}

        {onToggleRight && (
          <ToolbarButton
            tooltip={rightOpen ? `收起辅助栏 (${toggleRightShortcut})` : `展开辅助栏 (${toggleRightShortcut})`}
            className={`toolbar-panel-btn ${!rightOpen ? "is-collapsed" : ""}`}
            icon={rightOpen ? PanelRightClose : PanelRightOpen}
            iconSize={16}
            label={rightOpen ? "收起辅助栏" : "展开辅助栏"}
            onClick={onToggleRight}
            selected={false}
          />
        )}
      </div>
    </div>
  );
}
