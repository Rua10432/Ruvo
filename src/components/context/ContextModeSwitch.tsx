import { Link2, ListTree } from "lucide-react";
import type { ContextMode } from "../../types";

type ContextModeSwitchProps = {
  mode: ContextMode;
  onModeChange: (mode: ContextMode) => void;
};

export default function ContextModeSwitch({ mode, onModeChange }: ContextModeSwitchProps) {
  return (
    <div className="right-sidebar-segmented-wrap">
      <mdui-segmented-button-group
        selects="single"
        full-width
        value={mode}
        className="right-sidebar-segmented"
      >
        <mdui-segmented-button
          value="outline"
          onClick={() => onModeChange("outline")}
        >
          <ListTree size={16} slot="icon" />
          大纲
        </mdui-segmented-button>
        <mdui-segmented-button
          value="backlinks"
          onClick={() => onModeChange("backlinks")}
        >
          <Link2 size={16} slot="icon" />
          反向链接
        </mdui-segmented-button>
      </mdui-segmented-button-group>
    </div>
  );
}
