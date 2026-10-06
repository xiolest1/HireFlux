const IDENTITY_STORAGE_KEYS = [
  "hireflux-search-tour", "hireflux-recruiter-guide", "hireflux-account-preview.v1",
  "hireflux.time-zone-manual.v1",
];

export function clearIdentityUiState({ preserveManualTimeZone = false } = {}): void {
  for (const key of IDENTITY_STORAGE_KEYS) {
    if (preserveManualTimeZone && key === "hireflux.time-zone-manual.v1") continue;
    try { window.sessionStorage.removeItem(key); } catch { /* Optional UI state. */ }
  }
}
