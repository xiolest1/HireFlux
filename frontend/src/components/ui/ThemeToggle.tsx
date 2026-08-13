import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import {
  applyTheme,
  preferredTheme,
  storedThemePreference,
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

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function syncSystemTheme(event: MediaQueryListEvent) {
      if (storedThemePreference() !== "system") return;
      const next = event.matches ? "dark" : "light";
      applyTheme(next);
      setTheme(next);
    }
    media.addEventListener?.("change", syncSystemTheme);
    return () => media.removeEventListener?.("change", syncSystemTheme);
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
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink-muted shadow-sm transition-[color,background-color,border-color,transform] duration-200 hover:border-accent/60 hover:bg-surface-muted hover:text-ink active:scale-95 disabled:cursor-wait disabled:opacity-60"
    >
      {isDark ? (
        <Sun aria-hidden="true" className="size-5" strokeWidth={1.8} />
      ) : (
        <Moon aria-hidden="true" className="size-5" strokeWidth={1.8} />
      )}
    </button>
  );
}
