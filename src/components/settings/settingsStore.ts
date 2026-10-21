import { useState, useEffect, useCallback, useMemo } from "react";
import { applyTheme, getSavedTheme } from "../../utils/theme";
import { DEFAULT_SHORTCUTS } from "../../utils/shortcutUtils";
import type { ThemeMode } from "../../types";

export interface RuvoSettings {
  theme: ThemeMode;
  editorFontSize: number;
  editorLineHeight: number;
  autoSave: boolean;
  autoSaveInterval: number;
  showWordCount: boolean;
  spellcheck: boolean;
  circleAnimation: boolean;
  autoCheckUpdate: boolean;
  shortcuts: Record<string, string>;
}

/** Backward compatibility alias */
export type RuamSettings = RuvoSettings;

export const SETTINGS_STORAGE_KEY = "ruvo-settings";
export const LEGACY_SETTINGS_STORAGE_KEY = "ruam-settings";

export const SETTINGS_CHANGE_EVENT = "ruvo-settings-change";
export const LEGACY_SETTINGS_CHANGE_EVENT = "ruam-settings-change";

export const SETTINGS_BROADCAST_CHANNEL = "ruvo-settings-channel";
export const LEGACY_SETTINGS_BROADCAST_CHANNEL = "ruam-settings-channel";

export const DEFAULT_SETTINGS: RuvoSettings = {
  theme: "arona",
  editorFontSize: 15,
  editorLineHeight: 1.6,
  autoSave: true,
  autoSaveInterval: 1000,
  showWordCount: true,
  spellcheck: false,
  circleAnimation: true,
  autoCheckUpdate: true,
  shortcuts: { ...DEFAULT_SHORTCUTS },
};

type SettingsListener = (settings: RuvoSettings) => void;
const listeners = new Set<SettingsListener>();

export const WINDOW_INSTANCE_ID =
  typeof window !== "undefined"
    ? `win_${Math.random().toString(36).slice(2)}_${Date.now()}`
    : "win_ssr";

interface SettingsSyncMessage {
  settings: RuvoSettings;
  senderId: string;
}

let broadcastChannel: BroadcastChannel | null = null;
let legacyBroadcastChannel: BroadcastChannel | null = null;

if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  const handleIncomingMessage = (event: MessageEvent<SettingsSyncMessage | RuvoSettings>) => {
    if (!event.data || typeof event.data !== "object") return;
    if ("senderId" in event.data && event.data.senderId === WINDOW_INSTANCE_ID) {
      return;
    }
    const raw =
      "settings" in event.data && event.data.settings
        ? event.data.settings
        : (event.data as RuvoSettings);
    const next = sanitizeSettings(raw);
    if (next.theme) {
      applyTheme(next.theme);
    }
    applyEditorCssVariables(next);
    notifyListeners(next);
  };

  try {
    broadcastChannel = new BroadcastChannel(SETTINGS_BROADCAST_CHANNEL);
    broadcastChannel.onmessage = handleIncomingMessage;
  } catch {
    // BroadcastChannel unsupported or restricted in environment
  }

  try {
    legacyBroadcastChannel = new BroadcastChannel(LEGACY_SETTINGS_BROADCAST_CHANNEL);
    legacyBroadcastChannel.onmessage = handleIncomingMessage;
  } catch {
    // Legacy BroadcastChannel unsupported
  }
}

let isTauriListening = false;

/**
 * Initializes Tauri native cross-window event synchronization.
 * This guarantees real-time synchronization between the Main window and Settings window.
 */
export function initTauriEventSync(): void {
  if (isTauriListening || typeof window === "undefined" || !(window as any).__TAURI_INTERNALS__) {
    return;
  }
  isTauriListening = true;

  import("@tauri-apps/api/event")
    .then(({ listen }) => {
      const handleTauriPayload = (event: { payload?: unknown }) => {
        if (!event.payload || typeof event.payload !== "object") return;

        // Ignore echo events sent from this exact window instance
        const payloadObj = event.payload as Record<string, unknown>;
        if ("senderId" in payloadObj && payloadObj.senderId === WINDOW_INSTANCE_ID) {
          return;
        }

        const raw =
          "settings" in payloadObj && payloadObj.settings
            ? (payloadObj.settings as Partial<RuvoSettings>)
            : (event.payload as RuvoSettings);

        const next = sanitizeSettings(raw);

        try {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage failure
        }

        if (next.theme) {
          applyTheme(next.theme);
        }
        applyEditorCssVariables(next);
        notifyListeners(next);
      };

      void listen<SettingsSyncMessage | RuvoSettings>(SETTINGS_CHANGE_EVENT, handleTauriPayload);
      void listen<SettingsSyncMessage | RuvoSettings>(LEGACY_SETTINGS_CHANGE_EVENT, handleTauriPayload);
    })
    .catch((err) => {
      console.warn("Failed to register Tauri settings listener:", err);
      isTauriListening = false;
    });
}

/**
 * Applies editor font-size and line-height as CSS variables on documentElement.
 * Populates both --ruvo-* (primary) and --ruam-* (backward compatibility) variables.
 */
export function applyEditorCssVariables(settings: RuvoSettings): void {
  if (typeof document === "undefined") return;
  const fontSizePx = `${settings.editorFontSize}px`;
  const lineHeightVal = `${settings.editorLineHeight}`;
  const fontFamilyVal =
    '"Roboto", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

  document.documentElement.style.setProperty("--ruvo-editor-font-size", fontSizePx);
  document.documentElement.style.setProperty("--ruam-editor-font-size", fontSizePx);

  document.documentElement.style.setProperty("--ruvo-editor-line-height", lineHeightVal);
  document.documentElement.style.setProperty("--ruam-editor-line-height", lineHeightVal);

  document.documentElement.style.setProperty("--ruvo-font-family", fontFamilyVal);
  document.documentElement.style.setProperty("--ruam-font-family", fontFamilyVal);
}

/**
 * Validates and clamps setting fields.
 */
function sanitizeSettings(raw: Partial<RuvoSettings> | null | undefined): RuvoSettings {
  const fallbackTheme = getSavedTheme();
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_SETTINGS, theme: fallbackTheme };
  }

  const theme: ThemeMode =
    raw.theme === "plana" || raw.theme === "arona" ? raw.theme : fallbackTheme;

  const editorFontSize =
    typeof raw.editorFontSize === "number" && !Number.isNaN(raw.editorFontSize)
      ? Math.min(24, Math.max(12, Math.round(raw.editorFontSize)))
      : DEFAULT_SETTINGS.editorFontSize;

  const editorLineHeight =
    typeof raw.editorLineHeight === "number" && !Number.isNaN(raw.editorLineHeight)
      ? Math.min(2.4, Math.max(1.2, parseFloat(raw.editorLineHeight.toFixed(1))))
      : DEFAULT_SETTINGS.editorLineHeight;

  const autoSave =
    typeof raw.autoSave === "boolean"
      ? raw.autoSave
      : DEFAULT_SETTINGS.autoSave;

  const autoSaveInterval =
    typeof raw.autoSaveInterval === "number" && raw.autoSaveInterval > 0
      ? raw.autoSaveInterval
      : DEFAULT_SETTINGS.autoSaveInterval;

  const showWordCount =
    typeof raw.showWordCount === "boolean"
      ? raw.showWordCount
      : DEFAULT_SETTINGS.showWordCount;

  const spellcheck =
    typeof raw.spellcheck === "boolean"
      ? raw.spellcheck
      : DEFAULT_SETTINGS.spellcheck;

  const circleAnimation =
    typeof raw.circleAnimation === "boolean"
      ? raw.circleAnimation
      : DEFAULT_SETTINGS.circleAnimation;

  const autoCheckUpdate =
    typeof raw.autoCheckUpdate === "boolean"
      ? raw.autoCheckUpdate
      : DEFAULT_SETTINGS.autoCheckUpdate;

  const shortcuts: Record<string, string> = { ...DEFAULT_SHORTCUTS };
  if (raw.shortcuts && typeof raw.shortcuts === "object") {
    for (const [key, val] of Object.entries(raw.shortcuts)) {
      if (typeof val === "string" && val.trim().length > 0) {
        shortcuts[key] = val.trim();
      }
    }
  }

  return {
    theme,
    editorFontSize,
    editorLineHeight,
    autoSave,
    autoSaveInterval,
    showWordCount,
    spellcheck,
    circleAnimation,
    autoCheckUpdate,
    shortcuts,
  };
}

let cachedSettings: RuvoSettings | null = null;

/**
 * Reads the current settings from localStorage (with legacy fallback), falling back to defaults.
 */
export function getSettings(): RuvoSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_SETTINGS };
  }

  if (cachedSettings) {
    return cachedSettings;
  }

  try {
    const raw =
      localStorage.getItem(SETTINGS_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_SETTINGS_STORAGE_KEY);
    if (!raw) {
      cachedSettings = sanitizeSettings({ theme: getSavedTheme() });
      return cachedSettings;
    }
    const parsed = JSON.parse(raw);
    cachedSettings = sanitizeSettings(parsed);
    return cachedSettings;
  } catch (err) {
    console.warn("Failed to read settings from localStorage:", err);
    cachedSettings = sanitizeSettings({ theme: getSavedTheme() });
    return cachedSettings;
  }
}

/**
 * Notifies all in-memory listeners.
 */
function notifyListeners(settings: RuvoSettings): void {
  for (const listener of listeners) {
    try {
      listener(settings);
    } catch (err) {
      console.error("Settings listener failed:", err);
    }
  }
}

/**
 * Updates user settings, persists to localStorage, applies theme/CSS variables,
 * and notifies active listeners and other windows.
 */
export function updateSettings(partial: Partial<RuvoSettings>): RuvoSettings {
  const current = getSettings();
  const next = sanitizeSettings({
    ...current,
    ...partial,
  });
  cachedSettings = next;

  // Persist to primary localStorage
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.error("Failed to save settings to localStorage:", err);
  }

  // Synchronize theme changes
  if (partial.theme && partial.theme !== current.theme) {
    applyTheme(next.theme);
  } else if (typeof document !== "undefined" && !document.documentElement.getAttribute("data-theme")) {
    applyTheme(next.theme);
  }

  // Update editor CSS variables
  applyEditorCssVariables(next);

  // Dispatch local window custom events (both current and legacy)
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent<RuvoSettings>(SETTINGS_CHANGE_EVENT, { detail: next })
      );
      window.dispatchEvent(
        new CustomEvent<RuvoSettings>(LEGACY_SETTINGS_CHANGE_EVENT, { detail: next })
      );
    } catch {
      // Ignore event dispatch failure
    }
  }

  const syncPayload: SettingsSyncMessage = {
    settings: next,
    senderId: WINDOW_INSTANCE_ID,
  };

  // Dispatch to other windows via BroadcastChannels
  try {
    broadcastChannel?.postMessage(syncPayload);
    legacyBroadcastChannel?.postMessage(syncPayload);
  } catch {
    // Ignore channel post failure
  }

  // Dispatch across Tauri windows via native event system
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    import("@tauri-apps/api/event")
      .then(({ emit }) => {
        void emit(SETTINGS_CHANGE_EVENT, syncPayload);
        void emit(LEGACY_SETTINGS_CHANGE_EVENT, syncPayload);
      })
      .catch((err) => {
        console.warn("Failed to emit Tauri settings event:", err);
      });
  }

  // Notify current in-memory subscribers
  notifyListeners(next);

  return next;
}

/**
 * Subscribes to settings changes within this window.
 */
export function subscribeSettings(callback: SettingsListener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

// Global initialization and listeners
if (typeof window !== "undefined") {
  // Initialize Tauri event sync
  initTauriEventSync();
  window.addEventListener("DOMContentLoaded", initTauriEventSync, { once: true });

  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key === SETTINGS_STORAGE_KEY || event.key === LEGACY_SETTINGS_STORAGE_KEY) {
      cachedSettings = null;
      const updated = getSettings();
      if (updated.theme) {
        applyTheme(updated.theme);
      }
      applyEditorCssVariables(updated);
      notifyListeners(updated);
    }
  });

  // Initialize CSS variables on script load
  try {
    applyEditorCssVariables(getSettings());
  } catch {
    // Ignore
  }
}

export type UseRuvoSettingsReturn = [
  RuvoSettings,
  (partial: Partial<RuvoSettings>) => RuvoSettings
] & {
  settings: RuvoSettings;
  updateSettings: (partial: Partial<RuvoSettings>) => RuvoSettings;
  resetSettings: () => RuvoSettings;
};

/** Backward compatibility return type alias */
export type UseRuamSettingsReturn = UseRuvoSettingsReturn;

/**
 * React hook to read and update RuvoSettings.
 * Syncs seamlessly across windows via custom, Tauri native, and storage events.
 *
 * Supports both object destructuring:
 *   const { settings, updateSettings } = useRuvoSettings();
 * and tuple destructuring:
 *   const [settings, updateSettings] = useRuvoSettings();
 */
export function useRuvoSettings(): UseRuvoSettingsReturn {
  const [settings, setSettings] = useState<RuvoSettings>(getSettings);

  useEffect(() => {
    // Ensure Tauri native event sync is active
    initTauriEventSync();

    // Initial sync
    const current = getSettings();
    setSettings(current);
    applyEditorCssVariables(current);

    // Subscribe to internal updates (covers local updates, storage, and cross-window sync)
    const unsubscribe = subscribeSettings((updated) => {
      setSettings(updated);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const update = useCallback((partial: Partial<RuvoSettings>) => {
    return updateSettings(partial);
  }, []);

  const reset = useCallback(() => {
    return updateSettings(DEFAULT_SETTINGS);
  }, []);

  return useMemo(() => {
    const tuple: [RuvoSettings, (partial: Partial<RuvoSettings>) => RuvoSettings] = [
      settings,
      update,
    ];
    return Object.assign(tuple, {
      settings,
      updateSettings: update,
      resetSettings: reset,
    });
  }, [settings, update, reset]);
}

/** Backward compatibility hook alias */
export const useRuamSettings = useRuvoSettings;
