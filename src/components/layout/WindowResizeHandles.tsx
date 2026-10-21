import type React from "react";
import { useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
// import "./WindowResizeHandles.css";

export type ResizeDirection =
  | "East"
  | "North"
  | "NorthEast"
  | "NorthWest"
  | "South"
  | "SouthEast"
  | "SouthWest"
  | "West";

interface WindowResizeHandlesProps {
  isMaximized?: boolean;
}

export default function WindowResizeHandles({ isMaximized }: WindowResizeHandlesProps) {
  const handleMouseDown = useCallback(
    (direction: ResizeDirection) => (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      try {
        if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
          void getCurrentWindow().startResizeDragging(direction);
        }
      } catch (err) {
        console.warn("Failed to start resize dragging:", err);
      }
    },
    []
  );

  if (isMaximized) return null;

  return (
    <div className="window-resize-handles" aria-hidden="true">
      <div className="win-resize-edge win-resize-top" onMouseDown={handleMouseDown("North")} />
      <div className="win-resize-edge win-resize-bottom" onMouseDown={handleMouseDown("South")} />
      <div className="win-resize-edge win-resize-left" onMouseDown={handleMouseDown("West")} />
      <div className="win-resize-edge win-resize-right" onMouseDown={handleMouseDown("East")} />
      <div className="win-resize-corner win-resize-top-left" onMouseDown={handleMouseDown("NorthWest")} />
      <div className="win-resize-corner win-resize-top-right" onMouseDown={handleMouseDown("NorthEast")} />
      <div className="win-resize-corner win-resize-bottom-left" onMouseDown={handleMouseDown("SouthWest")} />
      <div className="win-resize-corner win-resize-bottom-right" onMouseDown={handleMouseDown("SouthEast")} />
    </div>
  );
}
