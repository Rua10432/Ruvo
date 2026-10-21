import React from "react";
import type { ActiveFormats, FormatAction, ToolbarItemConfig } from "./toolbarConfig";
import { useRuvoSettings } from "../../settings/settingsStore";

export type ToolbarTooltipProps = {
  content: string;
  disabled?: boolean;
  tooltipDisabled?: boolean;
  placement?: "top" | "bottom" | "auto";
  children: React.ReactNode;
};

export function ToolbarTooltip({
  content,
  disabled = false,
  tooltipDisabled = false,
  placement = "bottom",
  children,
}: ToolbarTooltipProps) {
  return (
    <mdui-tooltip
      content={content}
      placement={placement}
      disabled={disabled || tooltipDisabled}
    >
      <span className={`toolbar-tooltip-target ${disabled ? "is-disabled" : ""}`}>
        {children}
      </span>
    </mdui-tooltip>
  );
}

export interface ToolbarButtonProps {
  tooltip: string;
  icon?: React.ComponentType<any>;
  iconSize?: number;
  label?: string;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  tooltipPlacement?: "top" | "bottom" | "auto";
  tooltipDisabled?: boolean;
}

export function ToolbarButton({
  tooltip,
  icon: Icon,
  iconSize = 16,
  label,
  selected = false,
  disabled = false,
  className = "",
  children,
  onClick,
  tooltipPlacement = "bottom",
  tooltipDisabled = false,
}: ToolbarButtonProps) {
  const ariaLabel = label || tooltip;
  const combinedClass = `toolbar-btn ${selected ? "is-active" : ""} ${className}`.trim();

  return (
    <ToolbarTooltip
      content={tooltip}
      placement={tooltipPlacement}
      disabled={disabled}
      tooltipDisabled={tooltipDisabled}
    >
      <mdui-button-icon
        variant="standard"
        className={combinedClass}
        selected={selected ? true : undefined}
        disabled={disabled}
        onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
        onClick={(e: React.MouseEvent) => {
          if (!disabled && onClick) {
            onClick(e);
          }
        }}
        aria-label={ariaLabel}
      >
        {children ? children : Icon ? <Icon size={iconSize} /> : null}
      </mdui-button-icon>
    </ToolbarTooltip>
  );
}

const ACTION_TO_SHORTCUT_KEY: Record<string, string> = {
  undo: "undo",
  redo: "redo",
  bold: "bold",
  italic: "italic",
  strikethrough: "strikethrough",
  code: "inlineCode",
  "code-block": "codeBlock",
  link: "link",
  image: "image",
  "task-list": "taskList",
  "bullet-list": "bulletList",
  "numbered-list": "numberedList",
  quote: "quote",
};

export interface ToolbarConfigButtonProps {
  item: ToolbarItemConfig;
  activeFormats?: ActiveFormats;
  disabled?: boolean;
  onFormat?: (action: FormatAction) => void;
  className?: string;
}

export function ToolbarConfigButton({
  item,
  activeFormats,
  disabled = false,
  onFormat,
  className = "",
}: ToolbarConfigButtonProps) {
  const { settings } = useRuvoSettings();
  const isSelected = item.formatKey ? Boolean(activeFormats?.[item.formatKey]) : false;

  const shortcutId = ACTION_TO_SHORTCUT_KEY[item.action];
  const dynamicShortcut = (shortcutId && settings.shortcuts?.[shortcutId]) || item.shortcut;

  const cleanLabel = item.label.replace(/\s*\([^)]*\)/, "");
  const baseTooltip = isSelected && item.activeTooltip ? item.activeTooltip : cleanLabel;
  const tooltipText = dynamicShortcut ? `${baseTooltip} (${dynamicShortcut})` : baseTooltip;

  return (
    <ToolbarButton
      tooltip={tooltipText}
      icon={item.icon}
      iconSize={item.iconSize}
      label={cleanLabel}
      selected={isSelected}
      disabled={disabled}
      className={className}
      onClick={() => onFormat?.(item.action)}
    />
  );
}

export default ToolbarButton;
