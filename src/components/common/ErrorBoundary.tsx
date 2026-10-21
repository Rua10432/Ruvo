import { Component, type ErrorInfo, type ReactNode } from "react";
import { snackbar } from "mdui";
import { AlertTriangle, FileText, Check } from "lucide-react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  draftCopied: boolean;
  draftContent: string | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      draftCopied: false,
      draftContent: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Ruvo ErrorBoundary caught an unhandled error:", error, errorInfo);

    // Attempt to salvage any uncommitted draft content from the editor DOM
    let draftText: string | null = null;
    try {
      const editorEl = document.querySelector(".notebooklm-editor") as HTMLElement | null;
      if (editorEl) {
        const text = editorEl.innerText || editorEl.textContent;
        if (text && text.trim().length > 0) {
          draftText = text.trim();
        }
      }
    } catch {
      // DOM extraction failed gracefully
    }

    this.setState({ errorInfo, draftContent: draftText });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleCopyError = async () => {
    const { error, errorInfo } = this.state;
    const errorDetails = [
      `=== Ruvo Crash Report ===`,
      `Time: ${new Date().toISOString()}`,
      `URL: ${window.location.href}`,
      `User Agent: ${navigator.userAgent}`,
      ``,
      `--- Error Message ---`,
      error ? `${error.name}: ${error.message}` : "Unknown error",
      ``,
      `--- Stack Trace ---`,
      error?.stack || "No stack trace available",
      ``,
      `--- Component Stack ---`,
      errorInfo?.componentStack || "No component stack available",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(errorDetails);
      this.setState({ copied: true });
      snackbar({ message: "错误日志已复制到剪贴板" });
      setTimeout(() => this.setState({ copied: false }), 2500);
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = errorDetails;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        this.setState({ copied: true });
        snackbar({ message: "错误日志已复制到剪贴板" });
        setTimeout(() => this.setState({ copied: false }), 2500);
      } catch {
        snackbar({ message: "复制失败，请在详情中手动选择复制" });
      }
    }
  };

  handleCopyDraft = async () => {
    const { draftContent } = this.state;
    if (!draftContent) return;

    try {
      await navigator.clipboard.writeText(draftContent);
      this.setState({ draftCopied: true });
      snackbar({ message: "未保存草稿已复制到剪贴板" });
      setTimeout(() => this.setState({ draftCopied: false }), 2500);
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = draftContent;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        this.setState({ draftCopied: true });
        snackbar({ message: "未保存草稿已复制到剪贴板" });
        setTimeout(() => this.setState({ draftCopied: false }), 2500);
      } catch {
        snackbar({ message: "草稿复制失败，请手动选择复制" });
      }
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const { error, errorInfo, draftCopied, draftContent } = this.state;

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          width: "100vw",
          padding: "24px",
          boxSizing: "border-box",
          backgroundColor: "var(--md-sys-color-surface)",
          color: "var(--md-sys-color-on-surface)",
          fontFamily: "var(--ruvo-font-family, var(--ruam-font-family, sans-serif))",
        }}
      >
        <div
          style={{
            maxWidth: "580px",
            width: "100%",
            borderRadius: "8px",
            border: "1px solid var(--ruvo-divider-color)",
            backgroundColor: "var(--md-sys-color-surface-container)",
            padding: "24px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <AlertTriangle size={22} style={{ color: "var(--md-sys-color-error)", flexShrink: 0 }} />
            <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>
              应用程序遇到了意外错误
            </h2>
          </div>

          {/* Description */}
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              lineHeight: 1.5,
              color: "var(--md-sys-color-on-surface-variant)",
            }}
          >
            界面渲染发生异常。您的本地笔记文件未受影响。您可以尝试重新加载页面，或复制错误信息进行反馈。
          </p>

          {/* Optional Draft Recovery */}
          {draftContent && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "6px",
                backgroundColor: "var(--md-sys-color-primary-container, rgba(2, 132, 199, 0.15))",
                color: "var(--md-sys-color-on-primary-container, #7dd3fc)",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <span>已检测到编辑器未保存的文字草稿（{draftContent.length} 字符），建议立即备份。</span>
              <mdui-button
                variant="filled"
                onClick={this.handleCopyDraft}
                style={{ flexShrink: 0 }}
              >
                {draftCopied ? <Check size={14} slot="icon" /> : <FileText size={14} slot="icon" />}
                {draftCopied ? "已复制草稿" : "复制草稿"}
              </mdui-button>
            </div>
          )}

          {/* Monospace stack trace box */}
          <pre
            style={{
              margin: 0,
              maxHeight: "160px",
              overflowY: "auto",
              backgroundColor: "var(--md-sys-color-surface-container-lowest)",
              borderRadius: "6px",
              padding: "10px 12px",
              fontFamily: "var(--ruvo-font-mono, monospace)",
              fontSize: "11.5px",
              lineHeight: 1.45,
              color: "var(--md-sys-color-on-surface)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              border: "1px solid var(--ruvo-divider-color, rgba(128, 128, 128, 0.15))",
              boxSizing: "border-box",
            }}
          >
            {error ? `${error.name}: ${error.message}\n\n` : ""}
            {error?.stack ? `Stack Trace:\n${error.stack}\n\n` : ""}
            {errorInfo?.componentStack ? `Component Stack:\n${errorInfo.componentStack}` : ""}
          </pre>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "8px",
            }}
          >
            <mdui-button variant="text" onClick={this.handleCopyError}>
              复制错误信息
            </mdui-button>
            <mdui-button variant="filled" onClick={this.handleReload}>
              重新加载页面
            </mdui-button>
          </div>
        </div>
      </div>
    );
  }
}
