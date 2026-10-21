import { Code2, Eye } from "lucide-react";
import type { ViewMode } from "../../types";

type ModeSwitchProps = {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
};

export default function ModeSwitch({ mode, onModeChange }: ModeSwitchProps) {
  return (
    <mdui-segmented-button-group
      selects="single"
      value={mode}
      className="stage-mode-segmented"
    >
      <mdui-segmented-button
        value="read"
        onClick={() => onModeChange("read")}
      >
        <Eye size={16} slot="icon" />
        阅读模式
      </mdui-segmented-button>
      <mdui-segmented-button
        value="edit"
        onClick={() => onModeChange("edit")}
      >
        <Code2 size={16} slot="icon" />
        编辑模式
      </mdui-segmented-button>
    </mdui-segmented-button-group>
  );
}
