export const THEME_STORAGE_KEY = "hireflux-color-theme";
export const THEME_EVENT = "hireflux-theme-change";

export type ColorMode = "light" | "dark";

export function storedTheme(): ColorMode | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function preferredTheme(): ColorMode {
  if (typeof window === "undefined") return "dark";
  return storedTheme() ?? "dark";
}

export function applyTheme(theme: ColorMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function setColorThemePreference(preference: "SYSTEM" | "LIGHT" | "DARK") {
  const theme: ColorMode =
    preference === "SYSTEM"
      ? typeof window.matchMedia !== "function" ||
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : (preference.toLowerCase() as ColorMode);
  try {
    if (preference === "SYSTEM") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The theme can still be applied for the active page.
  }
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme } }));
}
