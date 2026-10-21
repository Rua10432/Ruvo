import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Keyboard,
  Search,
  RotateCcw,
  AlertCircle,
  Sparkles,
  Command,
  FileCode,
  Layers,
} from "lucide-react";
import { useRuvoSettings } from "../settingsStore";
import {
  SHORTCUT_DEFINITIONS,
  DEFAULT_SHORTCUTS,
  CATEGORY_LABELS,
  eventToShortcutString,
  formatShortcutDisplay,
  findShortcutConflicts,
  type ShortcutCategory,
  type ShortcutDefinition,
} from "../../../utils/shortcutUtils";

export interface ShortcutsTabProps {
  onShowToast?: (msg: string) => void;
}

const CATEGORY_ICONS: Record<ShortcutCategory, React.ComponentType<{ size?: number }>> = {
  global: Command,
  editor: FileCode,
  insert: Layers,
};

export default function ShortcutsTab({ onShowToast }: ShortcutsTabProps) {
  const { settings, updateSettings } = useRuvoSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordingModifierHint, setRecordingModifierHint] = useState<string | null>(null);

  // Compute conflicting shortcut combinations
  const conflicts = useMemo(
    () => findShortcutConflicts(settings.shortcuts || DEFAULT_SHORTCUTS),
    [settings.shortcuts]
  );

  // Listen for keyboard input when recording a shortcut
  useEffect(() => {
    if (!recordingId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Always prevent default when recording to avoid triggering native browser/window actions
      e.preventDefault();
      e.stopPropagation();

      // Escape key cancels recording
      if (e.key === "Escape") {
        setRecordingId(null);
        setRecordingModifierHint(null);
        return;
      }

      // Check if combination is finished (i.e. a non-modifier key was pressed)
      const combo = eventToShortcutString(e);
      if (combo) {
        const def = SHORTCUT_DEFINITIONS.find((d: ShortcutDefinition) => d.id === recordingId);
        const nextShortcuts = {
          ...(settings.shortcuts || DEFAULT_SHORTCUTS),
          [recordingId]: combo,
        };

        updateSettings({ shortcuts: nextShortcuts });
        setRecordingId(null);
        setRecordingModifierHint(null);
        onShowToast?.(`已将「${def?.name || recordingId}」设置为 ${combo}`);
      } else {
        // Only modifier pressed so far, provide visual feedback
        const parts: string[] = [];
        if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
        if (e.altKey) parts.push("Alt");
        if (e.shiftKey) parts.push("Shift");
        setRecordingModifierHint(parts.length > 0 ? `${parts.join("+")}+...` : "...");
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [recordingId, settings.shortcuts, updateSettings, onShowToast]);

  // Click outside recording area cancels recording
  const handleCancelRecording = useCallback(() => {
    setRecordingId(null);
    setRecordingModifierHint(null);
  }, []);

  // Reset a single shortcut to default
  const handleResetSingle = useCallback(
    (def: ShortcutDefinition) => {
      const nextShortcuts = {
        ...(settings.shortcuts || DEFAULT_SHORTCUTS),
        [def.id]: def.defaultCombo,
      };
      updateSettings({ shortcuts: nextShortcuts });
      onShowToast?.(`「${def.name}」已恢复默认快捷键 (${def.defaultCombo})`);
    },
    [settings.shortcuts, updateSettings, onShowToast]
  );

  // Reset all shortcuts to system defaults
  const handleResetAll = useCallback(() => {
    updateSettings({ shortcuts: { ...DEFAULT_SHORTCUTS } });
    setRecordingId(null);
    setRecordingModifierHint(null);
    onShowToast?.("所有快捷键已恢复为初始默认值");
  }, [updateSettings, onShowToast]);

  // Filter definitions based on search query
  const filteredDefinitions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SHORTCUT_DEFINITIONS;

    return SHORTCUT_DEFINITIONS.filter((def: ShortcutDefinition) => {
      const currentCombo = (settings.shortcuts?.[def.id] || def.defaultCombo).toLowerCase();
      const defaultCombo = def.defaultCombo.toLowerCase();
      const name = def.name.toLowerCase();
      const desc = def.description.toLowerCase();
      return (
        name.includes(q) ||
        desc.includes(q) ||
        currentCombo.includes(q) ||
        defaultCombo.includes(q)
      );
    });
  }, [searchQuery, settings.shortcuts]);

  // Group filtered definitions by category
  const categories: ShortcutCategory[] = ["global", "editor", "insert"];

  return (
    <div className="settings-tab-panel shortcuts-tab-panel">
      {/* 搜索与全局控制栏 */}
      <div className="shortcuts-search-header">
        <div className="shortcuts-search-box">
          <mdui-text-field
            variant="outlined"
            placeholder="搜索快捷键功能名称或按键 (如: 保存, Ctrl+K)..."
            value={searchQuery}
            onInput={(e: React.FormEvent<HTMLElement>) => {
              const target = e.target as HTMLInputElement;
              setSearchQuery(target.value ?? "");
            }}
            clearable
            className="shortcuts-search-input"
          >
            <Search size={16} slot="icon" />
          </mdui-text-field>
        </div>

        <div className="shortcuts-global-actions">
          <mdui-button
            variant="text"
            className="shortcuts-reset-all-btn"
            onClick={handleResetAll}
            title="恢复全部默认快捷键"
          >
            <RotateCcw size={14} slot="icon" />
            恢复默认快捷键
          </mdui-button>
        </div>
      </div>

      {/* 提示条 */}
      <div className="shortcuts-hint-banner">
        <Sparkles size={15} className="shortcuts-hint-icon" />
        <span>
          点击快捷键徽标或“修改”按钮即可录制新按键。按下组合键（如 Ctrl+Shift+P）即刻生效，按 Esc 取消录制。
        </span>
      </div>

      {/* 按类别分组展示快捷键卡片 */}
      {categories.map((cat) => {
        const items = filteredDefinitions.filter((item: ShortcutDefinition) => item.category === cat);
        if (items.length === 0) return null;

        const CatIcon = CATEGORY_ICONS[cat] || Keyboard;
        const catInfo = CATEGORY_LABELS[cat];

        return (
          <section key={cat} className="settings-section">
            <h3 className="settings-section-title">
              <CatIcon size={16} />
              <span>{catInfo.label}</span>
              <span className="shortcuts-section-counter">{items.length}</span>
            </h3>

            <div className="settings-card divided">
              {items.map((def: ShortcutDefinition) => {
                const currentCombo = settings.shortcuts?.[def.id] || def.defaultCombo;
                const isRecording = recordingId === def.id;
                const isModified = currentCombo !== def.defaultCombo;
                const keyTokens = formatShortcutDisplay(currentCombo);
                const isConflicted =
                  Boolean(conflicts[currentCombo.trim().toLowerCase()]) &&
                  conflicts[currentCombo.trim().toLowerCase()].includes(def.id);

                return (
                  <div
                    key={def.id}
                    className={`settings-row shortcut-setting-row ${
                      isRecording ? "is-recording-row" : ""
                    }`}
                  >
                    {/* 左侧：名称、说明与冲突标记 */}
                    <div className="settings-row-info shortcut-row-info">
                      <div className="shortcut-label-line">
                        <span className="settings-row-label">{def.name}</span>
                        {isModified && (
                          <span className="shortcut-modified-tag" title="此快捷键已被自定义">
                            已修改
                          </span>
                        )}
                        {isConflicted && (
                          <span
                            className="shortcut-conflict-tag"
                            title="与其他快捷键存在键位冲突，可能无法正确响应"
                          >
                            <AlertCircle size={12} />
                            冲突
                          </span>
                        )}
                      </div>
                      <span className="settings-row-description">{def.description}</span>
                    </div>

                    {/* 右侧：按键徽标展示与操作按钮 */}
                    <div className="settings-row-control shortcut-row-control">
                      {isRecording ? (
                        <div className="shortcut-recording-container">
                          <mdui-button
                            variant="filled"
                            className="shortcut-recording-btn"
                            onClick={handleCancelRecording}
                          >
                            <span className="recording-pulse-dot" />
                            <span>
                              {recordingModifierHint
                                ? `按下按键: ${recordingModifierHint}`
                                : "请按下快捷键组合 (Esc 取消)..."}
                            </span>
                          </mdui-button>
                        </div>
                      ) : (
                        <div className="shortcut-keys-wrapper">
                          <div
                            className="shortcut-chips-group"
                            onClick={() => setRecordingId(def.id)}
                            title="点击修改此快捷键"
                            role="button"
                            tabIndex={0}
                          >
                            {keyTokens.map((token: string, idx: number) => (
                              <React.Fragment key={`${token}-${idx}`}>
                                <mdui-chip
                                  variant="assist"
                                  className="shortcut-key-chip"
                                >
                                  {token}
                                </mdui-chip>
                                {idx < keyTokens.length - 1 && (
                                  <span className="shortcut-chip-separator">+</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>

                          <div className="shortcut-row-actions">
                            <mdui-button
                              variant="outlined"
                              className="shortcut-edit-btn"
                              onClick={() => setRecordingId(def.id)}
                            >
                              修改
                            </mdui-button>

                            <mdui-tooltip
                              content={isModified ? "恢复为默认值" : "当前已是默认值"}
                              placement="top"
                            >
                              <mdui-button-icon
                                className="shortcut-reset-btn"
                                disabled={!isModified}
                                onClick={() => handleResetSingle(def)}
                                aria-label="恢复默认"
                              >
                                <RotateCcw size={14} />
                              </mdui-button-icon>
                            </mdui-tooltip>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* 搜索无结果占位 */}
      {filteredDefinitions.length === 0 && (
        <div className="shortcuts-empty-state">
          <Keyboard size={36} className="shortcuts-empty-icon" />
          <p className="shortcuts-empty-title">未找到匹配的快捷键</p>
          <p className="shortcuts-empty-desc">
            请尝试调整搜索关键词，或点击下方按钮清空搜索内容。
          </p>
          <mdui-button variant="outlined" onClick={() => setSearchQuery("")}>
            清空搜索
          </mdui-button>
        </div>
      )}
    </div>
  );
}
