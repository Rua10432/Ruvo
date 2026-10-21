export interface NoteSyncPayload {
  path: string;
  content: string;
  senderId: string;
  timestamp: number;
}

export const NOTE_SYNC_CHANNEL = "ruam-note-sync-channel";
export const NOTE_SYNC_EVENT = "ruam-note-sync-event";

export const WINDOW_ID =
  typeof window !== "undefined"
    ? `win_${Math.random().toString(36).slice(2)}_${Date.now()}`
    : "win_ssr";

type NoteSyncListener = (path: string, content: string) => void;
const listeners = new Set<NoteSyncListener>();

let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    broadcastChannel = new BroadcastChannel(NOTE_SYNC_CHANNEL);
    broadcastChannel.onmessage = (event: MessageEvent<NoteSyncPayload>) => {
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.senderId === WINDOW_ID) return;
      listeners.forEach((fn) => {
        try {
          fn(event.data.path, event.data.content);
        } catch (e) {
          console.error("Error in noteSync broadcastChannel listener:", e);
        }
      });
    };
  } catch {
    // BroadcastChannel unsupported or restricted
  }
}

if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
  import("@tauri-apps/api/event")
    .then(({ listen }) => {
      void listen<NoteSyncPayload>(NOTE_SYNC_EVENT, (event) => {
        if (!event.payload || typeof event.payload !== "object") return;
        if (event.payload.senderId === WINDOW_ID) return;
        listeners.forEach((fn) => {
          try {
            fn(event.payload.path, event.payload.content);
          } catch (e) {
            console.error("Error in noteSync tauri listener:", e);
          }
        });
      });
    })
    .catch(() => {});
}

/**
 * Broadcasts a note content modification to all other windows (sticky note <-> main window).
 */
export function broadcastNoteChange(path: string, content: string): void {
  if (typeof window === "undefined") return;

  const payload: NoteSyncPayload = {
    path,
    content,
    senderId: WINDOW_ID,
    timestamp: Date.now(),
  };

  // Broadcast via BroadcastChannel
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload);
    } catch {
      // ignore
    }
  }

  // Broadcast via Tauri native events
  if ((window as any).__TAURI_INTERNALS__) {
    import("@tauri-apps/api/event")
      .then(({ emit }) => {
        void emit(NOTE_SYNC_EVENT, payload);
      })
      .catch(() => {});
  }
}

/**
 * Subscribes to cross-window note content modifications.
 */
export function subscribeNoteChange(listener: NoteSyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// Window Control & Lifecycle Synchronization (Sticky Note <-> Main Window)
// ---------------------------------------------------------------------------

export interface WindowControlPayload {
  action: "restore-to-filebar" | "main-window-closed";
  path?: string;
  title?: string;
  senderId: string;
  timestamp: number;
}

export const RUAM_WINDOW_CONTROL_CHANNEL = "ruam-window-control-channel";
export const RUAM_WINDOW_CONTROL_EVENT = "ruam-window-control-event";

type RestoreListener = (path: string, title: string) => void;
type AppCloseListener = () => void;

const restoreListeners = new Set<RestoreListener>();
const appCloseListeners = new Set<AppCloseListener>();

let controlBroadcastChannel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    controlBroadcastChannel = new BroadcastChannel(RUAM_WINDOW_CONTROL_CHANNEL);
    controlBroadcastChannel.onmessage = (event: MessageEvent<WindowControlPayload>) => {
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.senderId === WINDOW_ID) return;
      if (event.data.action === "restore-to-filebar" && event.data.path) {
        restoreListeners.forEach((fn) => {
          try {
            fn(event.data.path!, event.data.title || "");
          } catch (e) {
            console.error("Error in restoreListener:", e);
          }
        });
      } else if (event.data.action === "main-window-closed") {
        appCloseListeners.forEach((fn) => {
          try {
            fn();
          } catch (e) {
            console.error("Error in appCloseListener:", e);
          }
        });
      }
    };
  } catch {
    // ignore
  }
}

if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
  import("@tauri-apps/api/event")
    .then(({ listen }) => {
      void listen<WindowControlPayload>(RUAM_WINDOW_CONTROL_EVENT, (event) => {
        if (!event.payload || typeof event.payload !== "object") return;
        if (event.payload.senderId === WINDOW_ID) return;
        if (event.payload.action === "restore-to-filebar" && event.payload.path) {
          restoreListeners.forEach((fn) => {
            try {
              fn(event.payload.path!, event.payload.title || "");
            } catch (e) {
              console.error("Error in tauri restoreListener:", e);
            }
          });
        } else if (event.payload.action === "main-window-closed") {
          appCloseListeners.forEach((fn) => {
            try {
              fn();
            } catch (e) {
              console.error("Error in tauri appCloseListener:", e);
            }
          });
        }
      });
    })
    .catch(() => {});
}

/**
 * Broadcasts a request to restore a sticky note into the main window's file/tab bar.
 */
export function broadcastRestoreToFileBar(path: string, title: string): void {
  if (typeof window === "undefined") return;
  const payload: WindowControlPayload = {
    action: "restore-to-filebar",
    path,
    title,
    senderId: WINDOW_ID,
    timestamp: Date.now(),
  };

  if (controlBroadcastChannel) {
    try {
      controlBroadcastChannel.postMessage(payload);
    } catch {
      // ignore
    }
  }

  if ((window as any).__TAURI_INTERNALS__) {
    import("@tauri-apps/api/event")
      .then(({ emit }) => {
        void emit(RUAM_WINDOW_CONTROL_EVENT, payload);
      })
      .catch(() => {});
  }
}

/**
 * Subscribes to requests to restore a note into the file/tab bar.
 */
export function subscribeRestoreToFileBar(listener: RestoreListener): () => void {
  restoreListeners.add(listener);
  return () => {
    restoreListeners.delete(listener);
  };
}

/**
 * Broadcasts an announcement that the main window is closing, so all child windows close.
 */
export function broadcastAppClosing(): void {
  if (typeof window === "undefined") return;
  const payload: WindowControlPayload = {
    action: "main-window-closed",
    senderId: WINDOW_ID,
    timestamp: Date.now(),
  };

  if (controlBroadcastChannel) {
    try {
      controlBroadcastChannel.postMessage(payload);
    } catch {
      // ignore
    }
  }

  if ((window as any).__TAURI_INTERNALS__) {
    import("@tauri-apps/api/event")
      .then(({ emit }) => {
        void emit(RUAM_WINDOW_CONTROL_EVENT, payload);
      })
      .catch(() => {});
  }
}

/**
 * Subscribes to main window close announcements to terminate child/sticky windows.
 */
export function subscribeAppClosing(listener: AppCloseListener): () => void {
  appCloseListeners.add(listener);
  return () => {
    appCloseListeners.delete(listener);
  };
}

