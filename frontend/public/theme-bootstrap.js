/* global document, window */

(() => {
  let storedTheme = null;
  try {
    storedTheme = window.localStorage.getItem("hireflux-color-theme");
  } catch {
    // Continue with the default dark theme when storage is blocked.
  }
  const useDarkTheme =
    storedTheme === "system"
      ? !window.matchMedia("(prefers-color-scheme: light)").matches
      : storedTheme !== "light";
  document.documentElement.classList.toggle("dark", useDarkTheme);
  document.documentElement.style.colorScheme = useDarkTheme ? "dark" : "light";
})();
