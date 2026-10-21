import { useId } from "react";
import { Type, ShieldCheck, Feather, Minus, Plus } from "lucide-react";
import { useRuvoSettings } from "../settingsStore";

export interface EditorTabProps {
  onShowToast?: (msg: string) => void;
}

export default function EditorTab({ onShowToast: _onShowToast }: EditorTabProps) {
  const { settings, updateSettings } = useRuvoSettings();

  const autoSaveId = useId();
  const wordCountId = useId();
  const spellcheckId = useId();

  return (
    <div className="settings-tab-panel">
      {/* 字号与排版 */}
      <section className="settings-section">
        <h3 className="settings-section-title">
          <Type size={16} />
          排版与字体
        </h3>

        <div className="settings-card divided">
          {/* 字号大小 */}
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">正文字号大小</span>
              <span className="settings-row-description">
                调整编辑器与预览区的默认字体大小 (范围: 12px ~ 24px)
              </span>
            </div>
            <div className="settings-row-control">
              <div className="md3-slider-stepper-box">
                <mdui-button-icon
                  className="md3-stepper-btn"
                  disabled={settings.editorFontSize <= 12}
                  onClick={() => updateSettings({ editorFontSize: settings.editorFontSize - 1 })}
                  title="减小字号"
                  aria-label="减小字号"
                >
                  <Minus size={14} />
                </mdui-button-icon>

                <mdui-slider
                  min={12}
                  max={24}
                  step={1}
                  value={settings.editorFontSize}
                  onInput={(e: any) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val)) updateSettings({ editorFontSize: val });
                  }}
                  onChange={(e: any) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val)) updateSettings({ editorFontSize: val });
                  }}
                  className="editor-font-size-slider"
                  aria-label="正文字号滑动条"
                ></mdui-slider>

                <mdui-button-icon
                  className="md3-stepper-btn"
                  disabled={settings.editorFontSize >= 24}
                  onClick={() => updateSettings({ editorFontSize: settings.editorFontSize + 1 })}
                  title="增大字号"
                  aria-label="增大字号"
                >
                  <Plus size={14} />
                </mdui-button-icon>

                <span className="md3-value-badge">{settings.editorFontSize} px</span>
              </div>
            </div>
          </div>

          {/* 行高比例 */}
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">行间距倍数</span>
              <span className="settings-row-description">
                设置正文多行段落的行高比例，改善长时间阅读体验
              </span>
            </div>
            <div className="settings-row-control">
              <mdui-segmented-button-group
                selects="single"
                value={String(settings.editorLineHeight)}
                className="editor-segmented-group"
              >
                <mdui-segmented-button
                  value="1.4"
                  onClick={() => updateSettings({ editorLineHeight: 1.4 })}
                >
                  紧凑 1.4
                </mdui-segmented-button>
                <mdui-segmented-button
                  value="1.6"
                  onClick={() => updateSettings({ editorLineHeight: 1.6 })}
                >
                  标准 1.6
                </mdui-segmented-button>
                <mdui-segmented-button
                  value="1.8"
                  onClick={() => updateSettings({ editorLineHeight: 1.8 })}
                >
                  宽松 1.8
                </mdui-segmented-button>
              </mdui-segmented-button-group>
            </div>
          </div>
        </div>

        {/* 实时排版预览区域 */}
        <div className="editor-live-preview">
          <div className="editor-preview-label">
            <Feather size={14} />
            <span>实时排版样例预览</span>
          </div>
          <div
            className="editor-preview-text"
            style={{
              fontSize: `${settings.editorFontSize}px`,
              lineHeight: settings.editorLineHeight,
            }}
          >
            <strong>排版与字体样例预览 Typography Preview</strong>
            <br />
            The quick brown fox jumps over the lazy dog. 敏捷的棕色狐狸跃过懒狗。0123456789 （标点与格式：【双链】『引用』“双引号”；：！？）
          </div>
        </div>
      </section>

      {/* 自动保存与编辑行为 */}
      <section className="settings-section">
        <h3 className="settings-section-title">
          <ShieldCheck size={16} />
          保存策略与编辑辅助
        </h3>

        <div className="settings-card divided">
          {/* 自动保存总开关 */}
          <div
            className="settings-row is-clickable"
            onClick={() => updateSettings({ autoSave: !settings.autoSave })}
          >
            <div className="settings-row-info">
              <label htmlFor={autoSaveId} className="settings-row-label">
                启用自动保存
              </label>
              <span className="settings-row-description">
                在停止键入后自动将未保存的内容持久化至本地磁盘，防止丢稿
              </span>
            </div>
            <div className="settings-row-control" onClick={(e) => e.stopPropagation()}>
              <mdui-switch
                id={autoSaveId}
                checked={settings.autoSave}
                onChange={(e: any) => updateSettings({ autoSave: e.target.checked })}
                aria-label="启用自动保存开关"
              />
            </div>
          </div>

          {/* 自动保存频率 */}
          <div
            className="settings-row"
            style={{
              opacity: settings.autoSave ? 1 : 0.5,
              pointerEvents: settings.autoSave ? "auto" : "none",
              transition: "opacity 0.2s ease",
            }}
          >
            <div className="settings-row-info">
              <span className="settings-row-label">自动保存延迟</span>
              <span className="settings-row-description">
                停止键入后触发本地磁盘写入的防抖间隔
              </span>
            </div>
            <div className="settings-row-control">
              <mdui-segmented-button-group
                selects="single"
                value={String(settings.autoSaveInterval)}
                className="editor-segmented-group"
              >
                <mdui-segmented-button
                  value="500"
                  onClick={() => updateSettings({ autoSaveInterval: 500 })}
                >
                  快速 (500ms)
                </mdui-segmented-button>
                <mdui-segmented-button
                  value="1000"
                  onClick={() => updateSettings({ autoSaveInterval: 1000 })}
                >
                  适中 (1s)
                </mdui-segmented-button>
                <mdui-segmented-button
                  value="2000"
                  onClick={() => updateSettings({ autoSaveInterval: 2000 })}
                >
                  稳妥 (2s)
                </mdui-segmented-button>
              </mdui-segmented-button-group>
            </div>
          </div>

          {/* 字数统计开关 */}
          <div
            className="settings-row is-clickable"
            onClick={() => updateSettings({ showWordCount: !settings.showWordCount })}
          >
            <div className="settings-row-info">
              <label htmlFor={wordCountId} className="settings-row-label">
                实时字数统计
              </label>
              <span className="settings-row-description">
                在底部状态栏实时显示当前笔记字数统计
              </span>
            </div>
            <div className="settings-row-control" onClick={(e) => e.stopPropagation()}>
              <mdui-switch
                id={wordCountId}
                checked={settings.showWordCount}
                onChange={(e: any) => updateSettings({ showWordCount: e.target.checked })}
                aria-label="实时字数统计开关"
              />
            </div>
          </div>

          {/* 拼写检查开关 */}
          <div
            className="settings-row is-clickable"
            onClick={() => updateSettings({ spellcheck: !settings.spellcheck })}
          >
            <div className="settings-row-info">
              <label htmlFor={spellcheckId} className="settings-row-label">
                拼写与语法检查
              </label>
              <span className="settings-row-description">
                启用编辑器原生拼写红色波浪线下划线检测 (支持英文与常见拼写)
              </span>
            </div>
            <div className="settings-row-control" onClick={(e) => e.stopPropagation()}>
              <mdui-switch
                id={spellcheckId}
                checked={settings.spellcheck}
                onChange={(e: any) => updateSettings({ spellcheck: e.target.checked })}
                aria-label="拼写与语法检查开关"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
