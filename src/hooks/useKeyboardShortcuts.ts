import { useEffect } from "react";
import { useRuamSettings } from "../components/settings/settingsStore";
import { matchesShortcut, DEFAULT_SHORTCUTS } from "../utils/shortcutUtils";

export interface KeyboardShortcutsHandlers {
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onCreateNote?: () => void;
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  onSave?: () => void;
}

export function useKeyboardShortcuts(
  onToggleLeftOrHandlers: (() => void) | KeyboardShortcutsHandlers,
  onToggleRight?: () => void,
  onCreateNote?: () => void,
  onOpenSearch?: () => void,
  onOpenSettings?: () => void,
  onSave?: () => void
) {
  const { settings } = useRuamSettings();
  const shortcuts = settings.shortcuts || DEFAULT_SHORTCUTS;

  useEffect(() => {
    const handlers: KeyboardShortcutsHandlers =
      typeof onToggleLeftOrHandlers === "function"
        ? {
            onToggleLeft: onToggleLeftOrHandlers,
            onToggleRight: onToggleRight!,
            onCreateNote,
            onOpenSearch,
            onOpenSettings,
            onSave,
          }
        : onToggleLeftOrHandlers;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target?.isContentEditable ||
        Boolean(target?.closest?.("[contenteditable], input, textarea"));

      // 1. Toggle Left Sidebar (when not typing in editable text)
      if (matchesShortcut(event, shortcuts.toggleLeftSidebar)) {
        if (!isEditable) {
          event.preventDefault();
          handlers.onToggleLeft();
          return;
        }
      }

      // 2. Toggle Right Sidebar (knowledge/backlinks panel)
      if (matchesShortcut(event, shortcuts.toggleRightSidebar)) {
        event.preventDefault();
        handlers.onToggleRight();
        return;
      }

      // 3. New Note (create note)
      if (matchesShortcut(event, shortcuts.newNote)) {
        if (!isEditable) {
          event.preventDefault();
          handlers.onCreateNote?.();
          return;
        }
      }

      // 4. Global Search (focus/open search tab)
      if (matchesShortcut(event, shortcuts.search)) {
        if (!isEditable) {
          event.preventDefault();
          handlers.onOpenSearch?.();
          return;
        }
      }

      // 5. Open Settings window
      if (matchesShortcut(event, shortcuts.openSettings)) {
        event.preventDefault();
        handlers.onOpenSettings?.();
        return;
      }

      // 6. Save Note
      if (matchesShortcut(event, shortcuts.saveNote)) {
        if (!isEditable) {
          event.preventDefault();
          handlers.onSave?.();
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    onToggleLeftOrHandlers,
    onToggleRight,
    onCreateNote,
    onOpenSearch,
    onOpenSettings,
    onSave,
    shortcuts,
  ]);
}
