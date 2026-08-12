import { useEffect, useState } from "react";
import {
  applyTheme,
  preferredTheme,
  THEME_EVENT,
  THEME_STORAGE_KEY,
  type ColorMode,
} from "./themePreference";

interface ThemeToggleProps {
  disabled?: boolean;
  onPreferenceChange?: (preference: "LIGHT" | "DARK") => void | Promise<unknown>;
}

export function ThemeToggle({ disabled = false, onPreferenceChange }: ThemeToggleProps = {}) {
  const [theme, setTheme] = useState<ColorMode>(preferredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    function syncTheme(event: Event) {
      const next = (event as CustomEvent<{ theme?: ColorMode }>).detail?.theme;
      if (next === "light" || next === "dark") setTheme(next);
    }
    window.addEventListener(THEME_EVENT, syncTheme);
    return () => window.removeEventListener(THEME_EVENT, syncTheme);
  }, []);

  const isDark = theme === "dark";
  const nextTheme = isDark ? "light" : "dark";

  async function toggleTheme() {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The theme still changes for this page when storage is unavailable.
    }
    setTheme(nextTheme);
    try {
      await onPreferenceChange?.(nextTheme.toUpperCase() as "LIGHT" | "DARK");
    } catch {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // The previous theme can still be restored for this page.
      }
      setTheme(theme);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggleTheme()}
      disabled={disabled}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      {isDark ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M20.5 14.1A8.5 8.5 0 0 1 9.9 3.5 8.5 8.5 0 1 0 20.5 14.1Z" />
        </svg>
      )}
    </button>
  );
}
