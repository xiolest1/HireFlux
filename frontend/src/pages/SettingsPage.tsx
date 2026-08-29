import {
  ArrowRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Download,
  KeyRound,
  Laptop,
  Mail,
  Palette,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ColorTheme, DashboardRange, Settings } from "../api/schemas";
import { useDemoSession } from "../auth/demoSessionContext";
import {
  detectBrowserTimeZone,
  hasManualTimeZonePreference,
} from "../auth/timeZonePreference";
import { Button } from "../components/ui/Button";
import { Drawer } from "../components/ui/Drawer";
import { ErrorPanel, SuccessBanner } from "../components/ui/Feedback";
import { Skeleton } from "../components/ui/Skeleton";
import { setColorThemePreference } from "../components/ui/themePreference";
import { WorkspaceFrame, WorkspaceIntro } from "../components/ui/WorkspaceComposition";
import { formatTimestamp } from "../features/applications/format";
import { useMe } from "../features/applications/queries";
import {
  useExportApplicationsCsv,
  useExportWorkspace,
  useSettings,
  useUpdateSettings,
} from "../features/resources/queries";

type SettingsDraft = Omit<Settings, "created_at" | "updated_at" | "version">;
type AccountPreviewKey = "identity" | "protection" | "notifications";
type NotificationPreviewKey = "followUps" | "interviews" | "digest";

interface AccountPreviewPreference {
  version: 1;
  workspace_marker: string;
  notifications: Record<NotificationPreviewKey, boolean>;
}

const ACCOUNT_PREVIEW_STORAGE_KEY = "hireflux-account-preview.v1";
const DEFAULT_NOTIFICATION_PREVIEW: Record<NotificationPreviewKey, boolean> = {
  followUps: true,
  interviews: true,
  digest: false,
};
const TIME_ZONES = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"];

function accountPreviewWorkspaceMarker(accessToken: string | undefined): string | null {
  if (!accessToken) return null;
  let hash = 2_166_136_261;
  for (const character of accessToken) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return `demo-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function readAccountPreviewPreference(
  marker: string | null,
): Record<NotificationPreviewKey, boolean> {
  if (!marker || typeof window === "undefined") return DEFAULT_NOTIFICATION_PREVIEW;
  try {
    const stored = window.sessionStorage.getItem(ACCOUNT_PREVIEW_STORAGE_KEY);
    if (!stored) return DEFAULT_NOTIFICATION_PREVIEW;
    const parsed = JSON.parse(stored) as Partial<AccountPreviewPreference>;
    const notifications = parsed.notifications;
    if (
      parsed.version !== 1 ||
      parsed.workspace_marker !== marker ||
      !notifications ||
      typeof notifications.followUps !== "boolean" ||
      typeof notifications.interviews !== "boolean" ||
      typeof notifications.digest !== "boolean"
    ) {
      return DEFAULT_NOTIFICATION_PREVIEW;
    }
    return notifications;
  } catch {
    return DEFAULT_NOTIFICATION_PREVIEW;
  }
}

function writeAccountPreviewPreference(
  marker: string | null,
  notifications: Record<NotificationPreviewKey, boolean>,
): void {
  if (!marker || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      ACCOUNT_PREVIEW_STORAGE_KEY,
      JSON.stringify({ version: 1, workspace_marker: marker, notifications }),
    );
  } catch {
    // The simulation remains usable when browser storage is unavailable.
  }
}

function draftFromSettings(settings: Settings): SettingsDraft {
  const { time_zone, default_follow_up_days, default_application_view, default_dashboard_range, theme } = settings;
  return { time_zone, default_follow_up_days, default_application_view, default_dashboard_range, theme };
}

function mergeRefreshedDraft(
  current: SettingsDraft | null,
  nextServer: SettingsDraft,
  dirtyFields: ReadonlySet<keyof SettingsDraft>,
): SettingsDraft {
  if (!current) return nextServer;
  const merged = { ...nextServer };
  if (dirtyFields.has("time_zone")) merged.time_zone = current.time_zone;
  if (dirtyFields.has("default_follow_up_days")) {
    merged.default_follow_up_days = current.default_follow_up_days;
  }
  if (dirtyFields.has("default_application_view")) {
    merged.default_application_view = current.default_application_view;
  }
  if (dirtyFields.has("default_dashboard_range")) {
    merged.default_dashboard_range = current.default_dashboard_range;
  }
  if (dirtyFields.has("theme")) merged.theme = current.theme;
  return merged;
}

function draftsMatch(left: SettingsDraft | null, right: SettingsDraft | null) {
  if (!left || !right) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function SettingsPage() {
  const settingsQuery = useSettings();
  const updateMutation = useUpdateSettings();
  const meQuery = useMe();
  const { session } = useDemoSession();
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const dirtyFields = useRef<Set<keyof SettingsDraft>>(new Set());
  const [saved, setSaved] = useState(false);
  const [profileNameOverride, setProfileNameOverride] = useState<string | null>(null);
  const [profilePreviewSaved, setProfilePreviewSaved] = useState(false);
  const browserTimeZone = detectBrowserTimeZone();
  const manualTimeZone = hasManualTimeZonePreference();
  const availableTimeZones = Array.from(
    new Set([
      ...(browserTimeZone ? [browserTimeZone] : []),
      ...(settingsQuery.data ? [settingsQuery.data.time_zone] : []),
      ...TIME_ZONES,
    ]),
  );

  useEffect(() => {
    setProfileNameOverride(null);
    setProfilePreviewSaved(false);
  }, [session?.access_token]);

  useEffect(() => {
    if (!settingsQuery.data) return;
    const nextServerDraft = draftFromSettings(settingsQuery.data);
    setDraft((current) => mergeRefreshedDraft(current, nextServerDraft, dirtyFields.current));
  }, [settingsQuery.data]);

  const original = settingsQuery.data ? draftFromSettings(settingsQuery.data) : null;
  const dirty = !draftsMatch(draft, original);

  function change(next: SettingsDraft) {
    if (settingsQuery.data) {
      const serverDraft = draftFromSettings(settingsQuery.data);
      for (const field of [
        "time_zone",
        "default_follow_up_days",
        "default_application_view",
        "default_dashboard_range",
        "theme",
      ] as const) {
        if (next[field] === serverDraft[field]) dirtyFields.current.delete(field);
        else dirtyFields.current.add(field);
      }
    }
    setDraft(next);
    setSaved(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || !settingsQuery.data || !dirty) return;
    setSaved(false);
    try {
      const savedSettings = await updateMutation.mutateAsync({ expected_version: settingsQuery.data.version, ...draft });
      dirtyFields.current.clear();
      setDraft(draftFromSettings(savedSettings));
      setColorThemePreference(savedSettings.theme);
      setSaved(true);
    } catch {
      return;
    }
  }

  function previewProfileChange(event: FormEvent) {
    event.preventDefault();
    if (!meQuery.data || !profileNameOverride?.trim()) return;
    setProfileNameOverride(profileNameOverride.trim());
    setProfilePreviewSaved(true);
  }

  const identityName = session ? "Demo Workspace" : meQuery.data?.name ?? "";
  const profileName = profileNameOverride ?? identityName;

  return (
    <WorkspaceFrame width="narrow" className="space-y-10">
      <WorkspaceIntro title="Settings & profile" lead="Configure how HireFlux works for this candidate workspace." context="Profile, preferences, exports, and optional account simulations stay together in one quiet utility flow." />

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,.52fr)]">
        <section className="border-b border-line pb-10" aria-labelledby="profile-title">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info"><UserRound aria-hidden="true" className="size-5" /></span>
            <div><h2 id="profile-title" className="text-xl font-bold text-ink">Profile</h2><p className="mt-1 text-sm leading-6 text-ink-muted">Try a profile update in this local preview. The signed-in demo identity remains server-owned.</p></div>
          </div>
          {meQuery.isPending ? <p className="mt-6 text-sm text-ink-muted" role="status">Loading profile…</p> : null}
          {meQuery.isError ? <div className="mt-6"><ErrorPanel compact error={meQuery.error} onRetry={() => void meQuery.refetch()} /></div> : null}
          {meQuery.data ? (
            <form className="mt-6 space-y-5" onSubmit={previewProfileChange}>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="profile-name" className="text-sm font-semibold text-ink">Name</label>
                  <input id="profile-name" value={profileName} onChange={(event) => { setProfileNameOverride(event.target.value); setProfilePreviewSaved(false); }} className="hf-field mt-2 px-3" />
                  <p id="profile-name-help" className="mt-2 text-xs leading-5 text-ink-tertiary">Simulation only · no profile write endpoint is used.</p>
                </div>
                <div>
                  <label htmlFor="profile-email" className="text-sm font-semibold text-ink">Email address</label>
                  <input id="profile-email" value={meQuery.data.email} readOnly disabled className="hf-field mt-2 px-3" />
                  <p className="mt-2 text-xs leading-5 text-ink-tertiary">Read-only in the demo; email verification and delivery are not enabled.</p>
                </div>
              </div>
              {profilePreviewSaved ? <SuccessBanner>Profile preview updated locally. The demo identity is unchanged.</SuccessBanner> : null}
              <div className="flex flex-col gap-3 border-t border-line-subtle pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-ink-tertiary">{profileNameOverride && profileNameOverride !== identityName ? "You have a local profile preview change." : "Profile preview matches the demo identity."}</p><Button type="submit" disabled={!profileNameOverride?.trim() || profileNameOverride.trim() === identityName}>Save profile preview</Button></div>
            </form>
          ) : null}
          {meQuery.data ? <dl className="mt-6 grid gap-5 border-t border-line-subtle pt-5 sm:grid-cols-2"><ProfileItem label="Account type" value="Demo workspace" /><ProfileItem label="Workspace focus" value="Candidate job search" /></dl> : null}
        </section>

        <aside className="border-l-2 border-line pl-5" aria-labelledby="workspace-lifecycle-title"><div className="flex items-start gap-3"><Clock3 aria-hidden="true" className="mt-1 size-5 shrink-0 text-ink-muted" /><div><h2 id="workspace-lifecycle-title" className="text-lg font-bold text-ink">Demo workspace</h2><p className="mt-1 text-sm leading-6 text-ink-muted">Private fictional data for this browser session. It expires automatically after 24 hours.</p></div></div><dl className="mt-5 grid gap-4 border-t border-line-subtle pt-5"><ProfileItem label="Workspace expires" value={session ? formatTimestamp(session.expires_at, settingsQuery.data?.time_zone ?? "UTC") : "Not available"} /><ProfileItem label="Persistence" value="This browser session only" /></dl></aside>
      </div>

      <section className="border-b border-line pb-10" aria-labelledby="preferences-title">
        <div className="pb-5"><div className="flex items-start gap-3"><Palette aria-hidden="true" className="mt-1 size-5 shrink-0 text-ink-muted" /><div><h2 id="preferences-title" className="font-display text-2xl font-bold text-ink">Preferences</h2><p className="mt-1 text-sm leading-6 text-ink-muted">These settings persist only for this isolated 24-hour workspace. New workspaces start with this browser&apos;s detected time zone; selecting a different zone creates a manual override.</p></div></div></div>
        {settingsQuery.isPending || (!draft && !settingsQuery.isError) ? <SettingsSkeleton /> : null}
        {settingsQuery.isError ? <div className="p-5 sm:p-6"><ErrorPanel compact error={settingsQuery.error} onRetry={() => void settingsQuery.refetch()} /></div> : null}
        {draft && settingsQuery.data ? (
          <form onSubmit={submit}>
            <div className="grid gap-5 py-5 sm:grid-cols-2">
              <SettingSelect label="Time zone" value={draft.time_zone} onChange={(value) => change({ ...draft, time_zone: value })}>{availableTimeZones.map((zone) => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}{!manualTimeZone && zone === browserTimeZone ? " (automatic)" : ""}</option>)}</SettingSelect>
              <div><label htmlFor="follow-up-days" className="text-sm font-semibold text-ink">Default follow-up interval</label><div className="relative mt-2"><input id="follow-up-days" type="number" min={1} max={30} value={draft.default_follow_up_days} onChange={(event) => change({ ...draft, default_follow_up_days: Number(event.target.value) })} className="hf-field px-3 pr-14" /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-tertiary">days</span></div></div>
              <SettingSelect label="Default application view" value={draft.default_application_view} onChange={(value) => change({ ...draft, default_application_view: value as SettingsDraft["default_application_view"] })}><option value="ACTIVE">Active pursuits</option><option value="ALL">All applications</option><option value="ARCHIVED">Archived</option></SettingSelect>
              <SettingSelect label="Default dashboard range" value={draft.default_dashboard_range} onChange={(value) => change({ ...draft, default_dashboard_range: value as DashboardRange })}><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="all">All time</option></SettingSelect>
              <SettingSelect label="Color theme" value={draft.theme} onChange={(value) => change({ ...draft, theme: value as ColorTheme })}><option value="SYSTEM">Use system preference</option><option value="LIGHT">Light</option><option value="DARK">Dark</option></SettingSelect>
            </div>
            <div className="space-y-4 border-t border-line-subtle pt-5">
              {updateMutation.error ? <ErrorPanel compact title="Preferences could not be saved" error={updateMutation.error} /> : null}
              {saved ? <SuccessBanner>Preferences saved for this demo workspace.</SuccessBanner> : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-ink-tertiary">{dirty ? "You have unsaved preference changes." : "Preferences are up to date."}</p><Button type="submit" disabled={!dirty || updateMutation.isPending || draft.default_follow_up_days < 1 || draft.default_follow_up_days > 30}>{updateMutation.isPending ? "Saving…" : "Save preferences"}</Button></div>
            </div>
          </form>
        ) : null}
      </section>

      <DataPrivacySection isDemo={Boolean(session)} />

      <CandidateAccountPreview
        workspaceToken={session?.access_token}
      />
    </WorkspaceFrame>
  );
}

function SettingsSkeleton() {
  return (
    <div className="p-5 sm:p-6" role="status" aria-label="Loading preferences">
      <span className="sr-only">Loading preferences…</span>
      <div aria-hidden="true" className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton rounded="lg" className="h-11 w-full" />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="mt-6 flex justify-end border-t border-line pt-5"><Skeleton rounded="lg" className="h-11 w-40" /></div>
    </div>
  );
}

function DataPrivacySection({ isDemo }: { isDemo: boolean }) {
  const exportMutation = useExportWorkspace();
  const applicationsCsvMutation = useExportApplicationsCsv();

  async function downloadExport() {
    const data = await exportMutation.mutateAsync();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "hireflux-workspace-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function downloadApplicationsCsv() {
    const file = await applicationsCsvMutation.mutateAsync();
    const url = URL.createObjectURL(file.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="border-b border-line pb-10" aria-labelledby="account-data-title">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
          <Download aria-hidden="true" className="size-5" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="account-data-title" className="text-xl font-bold text-ink">Data & privacy</h2>
            <PreviewStatus tone="available">Available in demo</PreviewStatus>
          </div>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {isDemo
              ? "Download a spreadsheet-friendly copy of the fictional applications in this temporary workspace."
              : "Export applications for review or download a complete machine-readable account copy."}
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-ink">{isDemo ? "Export sample applications" : "Export applications"}</p>
            <p className="text-sm text-ink-muted">CSV format · One row per application.</p>
          </div>
          <Button onClick={() => void downloadApplicationsCsv()} disabled={applicationsCsvMutation.isPending}>
            {applicationsCsvMutation.isPending ? "Preparing…" : "Export CSV"}
          </Button>
        </div>
        {!isDemo ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ink">Export my HireFlux data</p>
              <p className="text-sm text-ink-muted">JSON format · Account backup and portability.</p>
            </div>
            <Button onClick={() => void downloadExport()} disabled={exportMutation.isPending}>
              {exportMutation.isPending ? "Preparing…" : "Export JSON"}
            </Button>
          </div>
        ) : (
          <p className="rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm leading-6 text-warning">
            Full account export is unavailable because this workspace is temporary and contains fictional data.
          </p>
        )}
      </div>
      {applicationsCsvMutation.error ? <div className="mt-4"><ErrorPanel compact title="Application export could not be prepared" error={applicationsCsvMutation.error} /></div> : null}
      {applicationsCsvMutation.isSuccess ? <div className="mt-4"><SuccessBanner>Applications exported. The CSV file remains on your device only.</SuccessBanner></div> : null}
      {!isDemo && exportMutation.error ? <div className="mt-4"><ErrorPanel compact title="Account export could not be prepared" error={exportMutation.error} /></div> : null}
      {!isDemo && exportMutation.isSuccess ? <div className="mt-4"><SuccessBanner>Account data exported. The JSON file remains on your device only.</SuccessBanner></div> : null}
    </section>
  );
}

function CandidateAccountPreview({
  workspaceToken,
}: {
  workspaceToken: string | undefined;
}) {
  const workspaceMarker = accountPreviewWorkspaceMarker(workspaceToken);
  const [activePreview, setActivePreview] = useState<AccountPreviewKey | null>(null);
  const [previewCompleted, setPreviewCompleted] = useState<AccountPreviewKey | null>(null);
  const [notificationNotice, setNotificationNotice] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [notificationPreview, setNotificationPreview] = useState(() =>
    readAccountPreviewPreference(workspaceMarker),
  );

  useEffect(() => {
    setActivePreview(null);
    setPreviewCompleted(null);
    setNotificationNotice(false);
    setPreviewExpanded(false);
    setNotificationPreview(readAccountPreviewPreference(workspaceMarker));
  }, [workspaceMarker]);

  const capabilities = [
    {
      key: "identity" as const,
      icon: KeyRound,
      title: "Secure sign-in",
      description:
        "Explore how verified identity, recovery, and connected providers would protect a persistent account.",
    },
    {
      key: "protection" as const,
      icon: ShieldCheck,
      title: "Account protection",
      description:
        "Preview MFA enrollment and the active-session controls a candidate could manage.",
    },
    {
      key: "notifications" as const,
      icon: Bell,
      title: "Notification delivery",
      description:
        "See how opt-in reminders would move from saved preferences to a production delivery service.",
    },
  ];
  const candidateWorkflow = [
    {
      icon: BriefcaseBusiness,
      title: "Applications",
      description: "Track roles, stages, follow-ups, and the details behind each opportunity.",
      to: "/applications",
    },
    {
      icon: CalendarDays,
      title: "Interviews & notes",
      description: "Prepare for conversations and keep useful context close to each application.",
      to: "/interviews",
    },
    {
      icon: BarChart3,
      title: "Analytics",
      description:
        "Understand search momentum, time in stage, and outcomes without turning signals into predictions.",
      to: "/analytics",
    },
  ];
  const activeCapability = capabilities.find(({ key }) => key === activePreview);

  function updateNotificationPreview(key: NotificationPreviewKey, checked: boolean) {
    const next = { ...notificationPreview, [key]: checked };
    setNotificationPreview(next);
    setNotificationNotice(true);
    writeAccountPreviewPreference(workspaceMarker, next);
  }

  return (
    <section className="rounded-3xl border border-line bg-surface-raised dark:shadow-panel" aria-labelledby="account-preview-title">
      <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="account-preview-title" className="text-xl font-bold text-ink">Personal account preview</h2>
            <PreviewStatus tone="simulation">Optional simulation</PreviewStatus>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">Explore future sign-in, protection, notification, and portability controls without changing this demo identity.</p>
        </div>
        <button
          type="button"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line text-ink-muted hover:bg-surface-hover hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          aria-expanded={previewExpanded}
          aria-controls="personal-account-preview-content"
          aria-label={previewExpanded ? "Collapse personal account preview" : "Expand personal account preview"}
          onClick={() => setPreviewExpanded((value) => !value)}
        >
          <ChevronDown aria-hidden="true" className={`size-5 transition-transform ${previewExpanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div id="personal-account-preview-content" hidden={!previewExpanded} className="space-y-6 border-t border-line p-4 sm:p-6">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <div className="grid gap-px bg-line md:grid-cols-3">
          {capabilities.map(({ key, icon: Icon, title, description }) => (
            <article key={key} className="flex flex-col bg-surface-raised p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <PreviewStatus tone="simulation">Simulated preview</PreviewStatus>
              </div>
              <h3 className="mt-4 font-bold text-ink">{title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-ink-muted">{description}</p>
              <Button
                variant="secondary"
                className="mt-5 w-full justify-between"
                aria-haspopup="dialog"
                aria-expanded={activePreview === key}
                aria-controls="account-preview-drawer"
                onClick={() => {
                  setPreviewCompleted(null);
                  setActivePreview(key);
                }}
              >
                Explore {title.toLowerCase()}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            </article>
          ))}
          </div>
        </div>

      <section
          className="rounded-2xl border border-line bg-surface-raised p-5 shadow-sm sm:p-6"
          aria-labelledby="account-readiness-title"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="account-readiness-title" className="text-xl font-bold text-ink">
              Personal account foundations
            </h3>
            <PreviewStatus tone="planned">Production service required</PreviewStatus>
          </div>
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            The production capabilities that would support a private, persistent job search.
          </p>
          <ul className="mt-5 space-y-3">
            {[
              "Verified identity and recovery",
              "MFA and active-session controls",
              "Notification preferences",
              "Export and retention policy",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-ink-muted">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
                {item}
              </li>
            ))}
          </ul>
      </section>

      <section
        className="rounded-2xl border border-line bg-surface-raised p-5 shadow-sm sm:p-6"
        aria-labelledby="account-continuity-title"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 id="account-continuity-title" className="text-xl font-bold text-ink">
              What would carry over?
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">
              A future account-conversion service could preserve the work a candidate has already
              organized. This demo does not create an account or perform that migration.
            </p>
          </div>
          <PreviewStatus tone="planned">Future capability</PreviewStatus>
        </div>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            "Applications and stages",
            "Notes and interviews",
            "Follow-up dates",
            "Analytics history",
            "Workspace preferences",
            "Export-ready data",
          ].map((item) => (
            <li
              key={item}
              className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink"
            >
              <Check aria-hidden="true" className="size-4 shrink-0 text-accent" />
              {item}
            </li>
          ))}
        </ul>
        <ol className="mt-6 grid gap-3 border-t border-line pt-6 md:grid-cols-4">
          {[
            ["1", "Explore the demo", "Current demo"],
            ["2", "Create a personal account", "Future capability"],
            ["3", "Keep your search across devices", "Production service required"],
            ["4", "Control security and privacy", "Production service required"],
          ].map(([number, title, status]) => (
            <li key={number} className="rounded-2xl border border-line bg-surface p-4">
              <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent-strong">
                {number}
              </span>
              <p className="mt-3 text-sm font-bold text-ink">{title}</p>
              <p className="mt-1 text-xs leading-5 text-ink-muted">{status}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          className="rounded-2xl border border-line bg-surface-raised p-5 shadow-sm sm:p-6"
          aria-labelledby="candidate-workflow-title"
        >
          <div>
            <h3 id="candidate-workflow-title" className="text-xl font-bold text-ink">
              Your candidate workflow
            </h3>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              HireFlux keeps your personal search organized from the first saved role through the
              final outcome.
            </p>
          </div>
          <div className="mt-5 space-y-3">
            {candidateWorkflow.map(({ icon: Icon, title, description, to }) => (
              <Link
                key={title}
                to={to}
                className="group flex min-h-11 items-start gap-3 rounded-xl border border-line-subtle bg-surface p-3 transition-colors hover:border-line hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-accent">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">{title}</span>
                  <span className="mt-1 block text-xs leading-5 text-ink-muted">{description}</span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="mt-3 size-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                />
              </Link>
            ))}
          </div>
        </section>

        <section
          className="rounded-2xl border border-line bg-surface-raised p-5 shadow-sm sm:p-6"
          aria-labelledby="notification-preview-title"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Mail aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 id="notification-preview-title" className="text-xl font-bold text-ink">
                  Email notifications
                </h3>
                <PreviewStatus tone="simulation">Simulated preview</PreviewStatus>
              </div>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                Try the preferences a persistent account could save. Changes remain in this browser
                workspace and no emails or messages are sent.
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {(
              [
                ["followUps", "Follow-up reminders", "When a task reaches its due date."],
                ["interviews", "Interview reminders", "Before a scheduled conversation."],
                ["digest", "Weekly search digest", "A summary of movement and outcomes."],
              ] as const
            ).map(([key, label, description]) => (
              <label
                key={key}
                className="flex min-h-11 items-start gap-3 rounded-xl border border-line bg-surface p-3"
              >
                <input
                  aria-label={label}
                  type="checkbox"
                  checked={notificationPreview[key]}
                  onChange={(event) => updateNotificationPreview(key, event.target.checked)}
                  className="mt-1 size-4 accent-brand-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">{label}</span>
                  <span className="mt-1 block text-xs leading-5 text-ink-muted">{description}</span>
                </span>
              </label>
            ))}
          </div>
          {notificationNotice ? (
            <p className="mt-4 flex items-start gap-2 text-xs font-semibold leading-5 text-success" role="status">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Preview preferences saved for this demo workspace. Delivery remains disabled.
            </p>
          ) : (
            <p className="mt-4 flex items-start gap-2 text-xs font-semibold leading-5 text-accent">
              <Bell aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Simulation only · delivery remains unavailable in this demo.
            </p>
          )}
        </section>
      </div>

      <div className="rounded-2xl border border-warning/30 bg-warning-soft p-5 text-sm leading-6 text-warning sm:p-6">
        <strong>Demo boundary:</strong> passwords, MFA enrollment, email notification delivery,
        permanent account deletion, conversion to a persistent account, and persistent login are
        intentionally unavailable. Application export is active; interactive account controls are
        safe simulations only.
      </div>
      </div>

      <Drawer
        id="account-preview-drawer"
        open={Boolean(activeCapability)}
        onClose={() => setActivePreview(null)}
        title={activeCapability?.title ?? "Account preview"}
        description="Interactive product preview · no real account or security setting is changed."
        size="lg"
        footer={
          <p className="min-w-0 max-w-full break-words text-xs leading-5 text-ink-muted">
            Production implementation would require verified identity, server-owned preferences,
            audit events, and separately authorized account services.
          </p>
        }
      >
        {activePreview ? (
          <AccountPreviewDrawerContent
            preview={activePreview}
            completed={previewCompleted === activePreview}
            notifications={notificationPreview}
            onComplete={() => setPreviewCompleted(activePreview)}
          />
        ) : null}
      </Drawer>
    </section>
  );
}

function PreviewStatus({
  tone,
  children,
}: {
  tone: "available" | "simulation" | "planned";
  children: ReactNode;
}) {
  const toneClass = {
    available: "border-success/30 bg-success-soft text-success",
    simulation: "border-accent/30 bg-accent-soft text-accent-strong",
    planned: "border-violet/30 bg-violet-soft text-violet",
  }[tone];
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide ${toneClass}`}
    >
      {children}
    </span>
  );
}

function AccountPreviewDrawerContent({
  preview,
  completed,
  notifications,
  onComplete,
}: {
  preview: AccountPreviewKey;
  completed: boolean;
  notifications: Record<NotificationPreviewKey, boolean>;
  onComplete: () => void;
}) {
  if (preview === "identity") {
    return (
      <div className="space-y-5">
        <PreviewFlowHeading
          title="Verified identity and recovery"
          description="A persistent account would verify ownership before allowing recovery or identity changes."
        />
        <ol className="space-y-3">
          {[
            "Confirm the account email or connected identity provider.",
            "Issue a short-lived, single-use recovery challenge.",
            "Notify the account owner and record the security event.",
          ].map((step, index) => (
            <PreviewFlowStep key={step} number={index + 1}>{step}</PreviewFlowStep>
          ))}
        </ol>
        <Button onClick={onComplete} disabled={completed}>
          {completed ? "Recovery preview complete" : "Run recovery preview"}
        </Button>
        {completed ? (
          <SuccessBanner>
            Preview complete. No recovery challenge was created and the demo identity is unchanged.
          </SuccessBanner>
        ) : null}
      </div>
    );
  }

  if (preview === "protection") {
    return (
      <div className="space-y-6">
        <PreviewFlowHeading
          title="MFA and active sessions"
          description="Candidates would be able to strengthen sign-in and review where their account is currently active."
        />
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <Smartphone aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" />
            <div>
              <p className="font-bold text-ink">Authenticator app</p>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                A production flow would verify a time-based code before marking MFA as enrolled.
              </p>
            </div>
          </div>
          <Button className="mt-4" onClick={onComplete} disabled={completed}>
            {completed ? "MFA preview complete" : "Preview MFA setup"}
          </Button>
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-ink-muted">
            Simulated active sessions
          </h3>
          <div className="mt-3 space-y-3">
            <PreviewSession icon={Laptop} title="Current demo browser" detail="Active now · Temporary workspace" />
            <PreviewSession icon={Smartphone} title="Personal phone" detail="Example only · No session exists" />
          </div>
        </div>
        {completed ? (
          <SuccessBanner>
            Preview complete. No authenticator secret or persistent session was created.
          </SuccessBanner>
        ) : null}
      </div>
    );
  }

  const enabledCount = Object.values(notifications).filter(Boolean).length;
  return (
    <div className="space-y-5">
      <PreviewFlowHeading
        title="Notification delivery path"
        description="Saved preferences would be enforced before any reminder entered a production delivery service."
      />
      <ol className="space-y-3">
        <PreviewFlowStep number={1}>Candidate opts into specific reminder types.</PreviewFlowStep>
        <PreviewFlowStep number={2}>The server evaluates due work in the saved workspace time zone.</PreviewFlowStep>
        <PreviewFlowStep number={3}>A delivery service sends only allowed messages and records the result.</PreviewFlowStep>
      </ol>
      <div className="min-w-0 rounded-2xl border border-accent/30 bg-accent-soft p-4 text-sm leading-6 text-accent-strong [overflow-wrap:anywhere]">
        <strong>{enabledCount} of 3</strong> preview notification types are enabled in this browser
        workspace. Return to the Email notifications panel to change them. Delivery remains disabled.
      </div>
    </div>
  );
}

function PreviewFlowHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <PreviewStatus tone="simulation">Simulation only</PreviewStatus>
      <h3 className="mt-3 text-lg font-bold text-ink">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-ink-muted">{description}</p>
    </div>
  );
}

function PreviewFlowStep({
  number,
  children,
}: {
  number: number;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm leading-6 text-ink-muted">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent-strong">
        {number}
      </span>
      {children}
    </li>
  );
}

function PreviewSession({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Laptop;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line p-3">
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink-muted" />
      <div>
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="mt-1 text-xs leading-5 text-ink-muted">{detail}</p>
      </div>
    </div>
  );
}

function SettingSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const id = `setting-${label.toLowerCase().replaceAll(" ", "-")}`;
  return <div><label htmlFor={id} className="text-sm font-semibold text-ink">{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="hf-field mt-2 px-3 text-sm font-semibold">{children}</select></div>;
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold uppercase tracking-wide text-ink-tertiary">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-ink">{value}</dd></div>;
}
