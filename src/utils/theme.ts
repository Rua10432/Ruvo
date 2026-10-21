import { setTheme, setColorScheme } from "mdui";
import type { ThemeMode } from "../types";

export const THEME_STORAGE_KEY = "ruvo-theme";
export const LEGACY_THEME_STORAGE_KEY = "ruam-theme";

/**
 * Reads the saved theme preference from localStorage.
 * Defaults to 'arona' (light mode) if no preference is saved.
 */
export function getSavedTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "arona";
  }
  const saved =
    localStorage.getItem(THEME_STORAGE_KEY) ??
    localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
  if (saved === "plana" || saved === "arona") {
    return saved;
  }
  return "arona";
}

/**
 * Applies the given theme to the document and MDUI system,
 * and persists the choice to localStorage.
 */
export function applyTheme(theme: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  // Update HTML data-theme attribute
  document.documentElement.setAttribute("data-theme", theme);

  // Synchronize MDUI theme and color palette tokens
  setTheme(theme === "plana" ? "dark" : "light");
  setColorScheme(theme === "plana" ? "#b4c5ff" : "#0062a3");

  // Persist preference to localStorage
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (err) {
    console.error("Failed to save theme to localStorage:", err);
  }
}

/**
 * Toggles between Arona (light) and Plana (dark) themes and applies the change.
 */
export function toggleTheme(current: ThemeMode): ThemeMode {
  const next: ThemeMode = current === "arona" ? "plana" : "arona";
  applyTheme(next);
  return next;
}

export interface TransitionOrigin {
  x: number;
  y: number;
}

function isCircleAnimationEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw =
      localStorage.getItem("ruvo-settings") ??
      localStorage.getItem("ruam-settings");
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    return parsed.circleAnimation !== false;
  } catch {
    return true;
  }
}

/**
 * Toggles theme with a circular reveal animation using the View Transitions API.
 * Gracefully falls back if the API is unsupported, if disabled in settings,
 * or if the user prefers reduced motion.
 */
export async function toggleThemeWithTransition(
  current: ThemeMode,
  origin?: TransitionOrigin,
  onThemeChange?: (next: ThemeMode) => void,
  enableAnimation?: boolean
): Promise<ThemeMode> {
  const next: ThemeMode = current === "arona" ? "plana" : "arona";

  const animEnabled = enableAnimation ?? isCircleAnimationEnabled();

  const isTransitionSupported =
    animEnabled &&
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    "startViewTransition" in document &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!isTransitionSupported) {
    applyTheme(next);
    onThemeChange?.(next);
    return next;
  }

  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const transition = (document as any).startViewTransition(() => {
    applyTheme(next);
    onThemeChange?.(next);
  });

  try {
    await transition.ready;
    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 450,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
        pseudoElement: "::view-transition-new(root)",
      }
    );
  } catch (err) {
    console.warn("View transition animation failed:", err);
  }

  return next;
}

