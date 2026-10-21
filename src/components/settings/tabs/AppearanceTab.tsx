import { useState, useEffect, useId } from "react";
import { Layers, Info } from "lucide-react";
import { useRuvoSettings } from "../settingsStore";

export interface AppearanceTabProps {
  onShowToast?: (msg: string) => void;
}

export default function AppearanceTab({ onShowToast: _onShowToast }: AppearanceTabProps) {
  const { settings, updateSettings } = useRuvoSettings();
  const circleAnimId = useId();

  // System reduced motion preference check
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      setSystemReducedMotion(media.matches);
      const listener = (e: MediaQueryListEvent) => setSystemReducedMotion(e.matches);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
  }, []);

  return (
    <div className="settings-tab-panel">
      {/* 动效与过渡配置 */}
      <section className="settings-section">
        <h3 className="settings-section-title">
          <Layers size={16} />
          交互与动效
        </h3>

        <div className="settings-card divided">
          <div
            className="settings-row is-clickable"
            onClick={() => updateSettings({ circleAnimation: !settings.circleAnimation })}
          >
            <div className="settings-row-info">
              <label htmlFor={circleAnimId} className="settings-row-label">
                圆形扩散切换动画
              </label>
              <span className="settings-row-description">
                切换主题时以点击位置为圆心展现平滑过渡扩散效果
              </span>
            </div>
            <div className="settings-row-control" onClick={(e) => e.stopPropagation()}>
              <mdui-switch
                id={circleAnimId}
                checked={settings.circleAnimation}
                onChange={(e: any) => updateSettings({ circleAnimation: e.target.checked })}
                aria-label="圆形扩散切换动画"
              />
            </div>
          </div>
        </div>

        <div className="info-callout">
          <Info size={16} className="info-callout-icon" />
          <div>
            {systemReducedMotion ? (
              <span>
                当前系统已检测到 <strong>「减弱动态效果」</strong> 偏好，主题切换与大范围界面过渡已自动优化为瞬时切换以保护视觉健康。
              </span>
            ) : (
              <span>
                当前系统支持高帧率流畅动效。若不需要扩散波纹动画，可随时在上方关闭，切换将改为即时生效。您随时可以在主界面的左侧活动栏底部点击主题按钮一键切换浅色/深色主题。
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
