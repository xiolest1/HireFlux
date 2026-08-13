export const THEME_STORAGE_KEY = "hireflux-color-theme";
export const THEME_EVENT = "hireflux-theme-change";

export type ColorMode = "light" | "dark";
export type StoredThemePreference = ColorMode | "system";

export function storedThemePreference(): StoredThemePreference | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" || value === "system"
      ? value
      : null;
  } catch {
    return null;
  }
}

export function storedTheme(): ColorMode | null {
  const preference = storedThemePreference();
  if (preference === "system") return systemTheme();
  return preference;
}

export function preferredTheme(): ColorMode {
  if (typeof window === "undefined") return "dark";
  return storedTheme() ?? "dark";
}

export function systemTheme(): ColorMode {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function applyTheme(theme: ColorMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function setColorThemePreference(preference: "SYSTEM" | "LIGHT" | "DARK") {
  const theme: ColorMode =
    preference === "SYSTEM" ? systemTheme() : (preference.toLowerCase() as ColorMode);
  try {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      preference === "SYSTEM" ? "system" : theme,
    );
  } catch {
    // The theme can still be applied for the active page.
  }
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme } }));
}
