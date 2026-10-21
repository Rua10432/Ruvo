import { PanelLeftOpen, PanelRightOpen } from "lucide-react";
import { useRuvoSettings } from "../settings/settingsStore";

type PanelReopenButtonProps = {
  side: "left" | "right";
  onClick: () => void;
};

export default function PanelReopenButton({ side, onClick }: PanelReopenButtonProps) {
  const { settings } = useRuvoSettings();
  const toggleLeftShortcut = settings.shortcuts?.toggleLeftSidebar || "Ctrl+B";
  const toggleRightShortcut = settings.shortcuts?.toggleRightSidebar || "Ctrl+J";
  const isLeft = side === "left";
  const tooltipContent = isLeft ? `展开左侧栏 (${toggleLeftShortcut})` : `展开右侧栏 (${toggleRightShortcut})`;
  const ariaLabel = isLeft ? "展开左侧栏" : "展开右侧栏";
  const className = `panel-reopen-button panel-reopen-button-${side}`;

  return (
    <mdui-tooltip content={tooltipContent} placement="bottom">
      <mdui-button-icon
        variant="filled"
        className={className}
        onClick={onClick}
        aria-label={ariaLabel}
      >
        {isLeft ? (
          <PanelLeftOpen size={18} strokeWidth={1.9} aria-hidden="true" />
        ) : (
          <PanelRightOpen size={18} strokeWidth={1.9} aria-hidden="true" />
        )}
      </mdui-button-icon>
    </mdui-tooltip>
  );
}
