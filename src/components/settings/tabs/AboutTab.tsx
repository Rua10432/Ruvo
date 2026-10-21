import { useCallback, useEffect, useState } from "react";
import {
  MonitorCheck,
  ExternalLink,
  RefreshCw,
  DownloadCloud,
  ArrowUpCircle,
  GitBranch,
} from "lucide-react";
import { useRuvoSettings } from "../settingsStore";
import {
  getUpdateState,
  subscribeUpdateState,
  checkForUpdates,
  startDownloadAndInstall,
  getAppVersion,
  type UpdateState,
} from "../../../services/updaterService";

export default function AboutTab() {
  const { settings, updateSettings } = useRuvoSettings();
  const [updateState, setUpdateState] = useState<UpdateState>(getUpdateState);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    void getAppVersion();
    return subscribeUpdateState((state) => {
      setUpdateState(state);
      if (state.phase === "downloading") {
        setIsUpdating(true);
      } else {
        setIsUpdating(false);
      }
    });
  }, []);

  const handleCheckUpdate = useCallback(() => {
    void checkForUpdates(true);
  }, []);

  const handleDownloadAndInstall = useCallback(async () => {
    try {
      setIsUpdating(true);
      await startDownloadAndInstall();
    } catch {
      // Error is tracked in updateState
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const handleToggleAutoCheck = useCallback(
    (e: any) => {
      const target = e.target as any;
      updateSettings({ autoCheckUpdate: Boolean(target.checked) });
    },
    [updateSettings]
  );

  const handleOpenExternal = useCallback(async (url: string) => {
    try {
      if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url);
        return;
      }
    } catch {
      // fallback
    }
    window.open(url, "_blank");
  }, []);

  return (
    <div className="settings-tab-panel">
      {/* 品牌头图 */}
      <div className="about-hero-card">
        <div className="about-emblem" aria-hidden="true">
          <img src="/app-icon.png" alt="Ruvo" className="about-emblem-img" />
        </div>
        <h2 className="about-name">Ruvo</h2>
        <span className="about-version-badge">v{updateState.currentVersion} (Alpha)</span>
        <p className="about-slogan">轻量便携的本地 Markdown 笔记应用</p>
      </div>

      {/* 软件更新模块 */}
      <section className="settings-section">
        <h3 className="settings-section-title">
          <ArrowUpCircle size={16} />
          版本与自动更新
        </h3>

        <div className="settings-card divided">
          {/* 版本检测主行 */}
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">软件版本</span>
              <span className="settings-row-description">
                {updateState.phase === "checking" && "正在连接更新服务器并检测新版本..."}
                {updateState.phase === "up-to-date" && "当前已是最新版本，无需更新。"}
                {updateState.phase === "available" && `发现新版本 v${updateState.newVersion} 可供升级！`}
                {updateState.phase === "downloading" && `正在下载更新包... ${updateState.progress}%`}
                {updateState.phase === "ready" && "新版本已下载完毕，重启即可完成安装！"}
                {updateState.phase === "error" && (
                  <span style={{ color: "var(--md-sys-color-error, #ef4444)" }}>
                    {updateState.errorMessage || "检测更新失败"}
                  </span>
                )}
                {updateState.phase === "idle" && "点击右侧按钮可手动检查是否有发布新版本。"}
              </span>
            </div>

            <div className="settings-row-control">
              {updateState.phase === "checking" && (
                <mdui-button variant="tonal" loading>
                  <RefreshCw size={14} slot="icon" />
                  检查中...
                </mdui-button>
              )}

              {updateState.phase === "available" && (
                <mdui-button variant="filled" onClick={handleDownloadAndInstall} disabled={isUpdating}>
                  <DownloadCloud size={14} slot="icon" />
                  立即下载并安装
                </mdui-button>
              )}

              {updateState.phase === "downloading" && (
                <span className="md3-value-badge" style={{ color: "var(--md-sys-color-primary)" }}>
                  {updateState.progress}%
                </span>
              )}

              {updateState.phase === "ready" && (
                <mdui-button
                  variant="filled"
                  onClick={async () => {
                    try {
                      if ((window as any).__TAURI_INTERNALS__) {
                        const { relaunch } = await import("@tauri-apps/plugin-process");
                        await relaunch();
                      } else {
                        window.location.reload();
                      }
                    } catch {
                      window.location.reload();
                    }
                  }}
                >
                  <RefreshCw size={14} slot="icon" />
                  立即重启生效
                </mdui-button>
              )}

              {(updateState.phase === "idle" ||
                updateState.phase === "up-to-date" ||
                updateState.phase === "error") && (
                <mdui-button variant="tonal" onClick={handleCheckUpdate}>
                  <RefreshCw size={14} slot="icon" />
                  检查更新
                </mdui-button>
              )}
            </div>
          </div>

          {/* 下载进度条展示 */}
          {updateState.phase === "downloading" && (
            <div style={{ padding: "0 16px 14px" }}>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: "var(--md-sys-color-surface-container-high, rgba(0,0,0,0.08))",
                  overflow: "hidden",
                  position: "relative",
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${updateState.progress}%`,
                    background: "var(--md-sys-color-primary)",
                    transition: "width 200ms ease",
                    borderRadius: 3,
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "var(--md-sys-color-on-surface-variant)",
                }}
              >
                <span>
                  {updateState.totalBytes > 0
                    ? `${(updateState.downloadedBytes / (1024 * 1024)).toFixed(1)} MB / ${(
                        updateState.totalBytes /
                        (1024 * 1024)
                      ).toFixed(1)} MB`
                    : "准备下载..."}
                </span>
                <span>{updateState.progress}%</span>
              </div>
            </div>
          )}

          {/* 新版本详情卡片 */}
          {updateState.phase === "available" && (
            <div
              style={{
                margin: "0 16px 14px",
                padding: "12px 14px",
                borderRadius: 8,
                background: "var(--md-sys-color-surface-container, rgba(0,0,0,0.04))",
                border: "1px solid var(--ruvo-divider-color, var(--ruam-divider-color))",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <strong style={{ color: "var(--md-sys-color-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                  <ArrowUpCircle size={14} />
                  Ruvo v{updateState.newVersion} 现已发布
                </strong>
                {updateState.releaseDate && (
                  <span style={{ fontSize: 11, color: "var(--md-sys-color-on-surface-variant)" }}>
                    {new Date(updateState.releaseDate).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div
                style={{
                  whiteSpace: "pre-line",
                  color: "var(--md-sys-color-on-surface)",
                  fontSize: 12.5,
                }}
              >
                {updateState.releaseNotes}
              </div>
            </div>
          )}

          {/* 自动检查更新设置 */}
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">启动时自动检查更新</span>
              <span className="settings-row-description">
                每次应用启动时静默检查官方最新版本，有更新时提示
              </span>
            </div>
            <div className="settings-row-control">
              <mdui-switch
                checked={settings.autoCheckUpdate}
                onChange={handleToggleAutoCheck}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 最低系统配置要求 */}
      <section className="settings-section">
        <h3 className="settings-section-title">
          <MonitorCheck size={16} />
          系统环境与最低配置要求
        </h3>

        <div className="settings-card divided">
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">操作系统 (OS)</span>
              <span className="settings-row-description">
                Windows 10 64位 (版本 1809 / 内部版本 17763) 或更高，或 Windows 11 全版本
              </span>
            </div>
            <div className="settings-row-control">
              <span className="md3-value-badge">Win 10 (17763+) / Win 11</span>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Web 运行环境</span>
              <span className="settings-row-description">
                Microsoft Edge WebView2 Evergreen Runtime (Win 11 及现代 Win 10 系统内置)
              </span>
            </div>
            <div className="settings-row-control">
              <span className="md3-value-badge">WebView2 必需</span>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">硬件配置要求</span>
              <span className="settings-row-description">
                x86_64 或 ARM64 处理器；最低 2GB RAM (建议 4GB 及以上)；最低可用存储空间 200MB
              </span>
            </div>
            <div className="settings-row-control">
              <span className="md3-value-badge">x64 / 2GB+ RAM</span>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">图形与视窗特性</span>
              <span className="settings-row-description">
                支持 DirectX 11 / DirectComposition 硬件加速合成；屏幕分辨率最低 1024×768
              </span>
            </div>
            <div className="settings-row-control">
              <span className="md3-value-badge">DirectComposition</span>
            </div>
          </div>
        </div>
      </section>

      {/* 开源社区与代码仓库 */}
      <section className="settings-section">
        <h3 className="settings-section-title">
          <GitBranch size={16} />
          开源社区与代码仓库
        </h3>

        <div className="settings-card divided">
          <div
            className="settings-row is-clickable"
            onClick={() => void handleOpenExternal("https://github.com/Rua10432/Ruvo")}
          >
            <div className="settings-row-info">
              <span className="settings-row-label">GitHub 代码仓库</span>
              <span className="settings-row-description">
                访问 Rua10432/Ruvo 官方仓库，获取最新源码、文档与版本发布
              </span>
            </div>
            <div className="settings-row-control">
              <mdui-button
                variant="outlined"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  void handleOpenExternal("https://github.com/Rua10432/Ruvo");
                }}
              >
                <GitBranch size={14} slot="icon" />
                访问仓库
              </mdui-button>
            </div>
          </div>

          <div
            className="settings-row is-clickable"
            onClick={() => void handleOpenExternal("https://github.com/Rua10432/Ruvo/issues")}
          >
            <div className="settings-row-info">
              <span className="settings-row-label">问题反馈与功能建议</span>
              <span className="settings-row-description">
                在 GitHub Issues 提交 Bug 反馈、体验改进或新功能构想
              </span>
            </div>
            <div className="settings-row-control">
              <mdui-button
                variant="tonal"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  void handleOpenExternal("https://github.com/Rua10432/Ruvo/issues");
                }}
              >
                <ExternalLink size={14} slot="icon" />
                提交 Issue
              </mdui-button>
            </div>
          </div>
        </div>
      </section>

      {/* 开源许可 */}
      <div className="about-license-card">
        <div>
          <div className="about-license-text">
            <strong>开源协议：</strong> GNU General Public License v3.0 (GPL-3.0)
          </div>
          <div className="about-license-sub">
            自由开源与数据自主，保障用户对软件与个人数据的绝对控制
          </div>
        </div>
        <span className="about-license-badge">GNU General Public License v3.0</span>
      </div>
    </div>
  );
}
