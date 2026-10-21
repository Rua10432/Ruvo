import { useEffect, useState } from "react";
import AppLayout from "./components/layout/AppLayout";
import SettingsApp from "./components/settings/SettingsApp";
import StickyNoteApp from "./components/sticky/StickyNoteApp";

export default function App() {
  const getWindowType = () =>
    typeof window !== "undefined"
      ? (window as any).__RUVO_WINDOW_TYPE__ ?? (window as any).__RUAM_WINDOW_TYPE__
      : undefined;

  const [isSettingsWindow, setIsSettingsWindow] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      getWindowType() === "settings" ||
      window.location.search.includes("window=settings") ||
      window.location.search.includes("settings") ||
      window.location.hash.includes("settings")
    );
  });

  const [isStickyNoteWindow, setIsStickyNoteWindow] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      getWindowType() === "sticky-note" ||
      window.location.search.includes("window=sticky-note") ||
      window.location.search.includes("sticky") ||
      window.location.hash.includes("sticky")
    );
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const winType = getWindowType();
      if (winType === "settings") {
        setIsSettingsWindow(true);
      } else if (winType === "sticky-note") {
        setIsStickyNoteWindow(true);
      } else if ((window as any).__TAURI_INTERNALS__) {
        import("@tauri-apps/api/window")
          .then(({ getCurrentWindow }) => {
            const label = getCurrentWindow().label;
            if (label === "settings") {
              setIsSettingsWindow(true);
            } else if (label.startsWith("sticky")) {
              setIsStickyNoteWindow(true);
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  if (isSettingsWindow) {
    return <SettingsApp />;
  }

  if (isStickyNoteWindow) {
    return <StickyNoteApp />;
  }

  return <AppLayout />;
}

