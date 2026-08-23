const MANUAL_TIME_ZONE_KEY = "hireflux.time-zone-manual.v1";

export function detectBrowserTimeZone(): string | null {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone) return null;
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return timeZone;
  } catch {
    return null;
  }
}

export function hasManualTimeZonePreference(): boolean {
  try {
    return window.sessionStorage.getItem(MANUAL_TIME_ZONE_KEY) === "true";
  } catch {
    return false;
  }
}

export function markManualTimeZonePreference(): void {
  try {
    window.sessionStorage.setItem(MANUAL_TIME_ZONE_KEY, "true");
  } catch {
    // The server-side setting remains authoritative if browser storage is unavailable.
  }
}

export function clearManualTimeZonePreference(): void {
  try {
    window.sessionStorage.removeItem(MANUAL_TIME_ZONE_KEY);
  } catch {
    // A new or exited workspace can still proceed without browser storage.
  }
}
