import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto/400-italic.css";
import "@fontsource/noto-sans-sc/400.css";
import "@fontsource/noto-sans-sc/500.css";
import "@fontsource/noto-sans-sc/700.css";
import "@fontsource/noto-sans-sc/chinese-simplified-400.css";
import "@fontsource/noto-sans-sc/chinese-simplified-500.css";
import "@fontsource/noto-sans-sc/chinese-simplified-700.css";
import "mdui/mdui.css";
import "mdui";
import { applyTheme, getSavedTheme } from "./utils/theme";
import { applyEditorCssVariables, getSettings } from "./components/settings/settingsStore";
import "./styles/m3-layout.css";
import "./SupplementaryStyles.css";
import App from "./App";
import ErrorBoundary from "./components/common/ErrorBoundary";

applyTheme(getSavedTheme());
applyEditorCssVariables(getSettings());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
