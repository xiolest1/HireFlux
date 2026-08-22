import { Bell, Check, Clock3, Download, KeyRound, Mail, Palette, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { ColorTheme, DashboardRange, Settings } from "../api/schemas";
import { useDemoSession } from "../auth/demoSessionContext";
import { Button } from "../components/ui/Button";
import { ErrorPanel, SuccessBanner } from "../components/ui/Feedback";
import { Skeleton } from "../components/ui/Skeleton";
import { setColorThemePreference } from "../components/ui/themePreference";
import { formatTimestamp } from "../features/applications/format";
import { useMe } from "../features/applications/queries";
import { useExportWorkspace, useSettings, useUpdateSettings } from "../features/resources/queries";

type SettingsDraft = Omit<Settings, "created_at" | "updated_at" | "version">;
const TIME_ZONES = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"];

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

  const profileName = profileNameOverride ?? meQuery.data?.name ?? "";

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">Workspace controls</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Settings & profile</h1>
        <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">Personalize this temporary workspace and preview account controls from one page.</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6" aria-labelledby="profile-title">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><UserRound aria-hidden="true" className="size-5" /></span>
            <div><h2 id="profile-title" className="text-xl font-bold text-slate-950">Profile</h2><p className="mt-1 text-sm leading-6 text-slate-600">Try a profile update in this local preview. The signed-in demo identity remains server-owned.</p></div>
          </div>
          {meQuery.isPending ? <p className="mt-6 text-sm text-slate-600" role="status">Loading profile…</p> : null}
          {meQuery.isError ? <div className="mt-6"><ErrorPanel compact error={meQuery.error} onRetry={() => void meQuery.refetch()} /></div> : null}
          {meQuery.data ? (
            <form className="mt-6 space-y-5" onSubmit={previewProfileChange}>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="profile-name" className="text-sm font-semibold text-slate-800">Name</label>
                  <input id="profile-name" value={profileName} onChange={(event) => { setProfileNameOverride(event.target.value); setProfilePreviewSaved(false); }} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900" />
                  <p id="profile-name-help" className="mt-2 text-xs leading-5 text-slate-500">Simulation only · no profile write endpoint is used.</p>
                </div>
                <div>
                  <label htmlFor="profile-email" className="text-sm font-semibold text-slate-800">Email address</label>
                  <input id="profile-email" value={meQuery.data.email} readOnly disabled className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-slate-500" />
                  <p className="mt-2 text-xs leading-5 text-slate-500">Read-only in the demo; email verification and delivery are not enabled.</p>
                </div>
              </div>
              {profilePreviewSaved ? <SuccessBanner>Profile preview updated locally. The demo identity is unchanged.</SuccessBanner> : null}
              <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-500">{profileNameOverride && profileNameOverride !== meQuery.data.name ? "You have a local profile preview change." : "Profile preview matches the demo identity."}</p><Button type="submit" disabled={!profileNameOverride?.trim() || profileNameOverride.trim() === meQuery.data.name}>Save profile preview</Button></div>
            </form>
          ) : null}
          {meQuery.data ? <dl className="mt-6 grid gap-5 border-t border-slate-200 pt-5 sm:grid-cols-2"><ProfileItem label="Account type" value="Isolated demo" /><ProfileItem label="Role" value="Standard user" /></dl> : null}
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-panel" aria-labelledby="workspace-lifecycle-title"><div className="bg-gradient-to-br from-brand-600 to-violet-700 p-5 text-white sm:p-6"><Clock3 aria-hidden="true" className="size-7" /><h2 id="workspace-lifecycle-title" className="mt-4 text-xl font-bold">Temporary by design</h2><p className="mt-2 text-sm leading-6 text-blue-50">Every recruiter gets a separate environment with fictional data. Nothing is shared with another visitor.</p></div><dl className="space-y-4 p-5 sm:p-6"><ProfileItem label="Workspace expires" value={session ? formatTimestamp(session.expires_at, settingsQuery.data?.time_zone ?? "UTC") : "Not available"} /><ProfileItem label="Data lifetime" value="24 hours" /><ProfileItem label="Persistence" value="This browser session only" /></dl></section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-panel" aria-labelledby="preferences-title">
        <div className="border-b border-slate-200 p-5 sm:p-6"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Palette aria-hidden="true" className="size-5" /></span><div><h2 id="preferences-title" className="text-xl font-bold text-slate-950">Preferences</h2><p className="mt-1 text-sm leading-6 text-slate-600">These settings persist only for this isolated 24-hour workspace.</p></div></div></div>
        {settingsQuery.isPending || (!draft && !settingsQuery.isError) ? <SettingsSkeleton /> : null}
        {settingsQuery.isError ? <div className="p-5 sm:p-6"><ErrorPanel compact error={settingsQuery.error} onRetry={() => void settingsQuery.refetch()} /></div> : null}
        {draft && settingsQuery.data ? (
          <form onSubmit={submit}>
            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <SettingSelect label="Time zone" value={draft.time_zone} onChange={(value) => change({ ...draft, time_zone: value })}>{TIME_ZONES.map((zone) => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}</SettingSelect>
              <div><label htmlFor="follow-up-days" className="text-sm font-semibold text-slate-800">Default follow-up interval</label><div className="relative mt-2"><input id="follow-up-days" type="number" min={1} max={30} value={draft.default_follow_up_days} onChange={(event) => change({ ...draft, default_follow_up_days: Number(event.target.value) })} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 pr-14 text-slate-900" /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">days</span></div></div>
              <SettingSelect label="Default application view" value={draft.default_application_view} onChange={(value) => change({ ...draft, default_application_view: value as SettingsDraft["default_application_view"] })}><option value="ACTIVE">Active pursuits</option><option value="ALL">All applications</option><option value="ARCHIVED">Archived</option></SettingSelect>
              <SettingSelect label="Default dashboard range" value={draft.default_dashboard_range} onChange={(value) => change({ ...draft, default_dashboard_range: value as DashboardRange })}><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="all">All time</option></SettingSelect>
              <SettingSelect label="Color theme" value={draft.theme} onChange={(value) => change({ ...draft, theme: value as ColorTheme })}><option value="SYSTEM">Use system preference</option><option value="LIGHT">Light</option><option value="DARK">Dark</option></SettingSelect>
            </div>
            <div className="space-y-4 border-t border-slate-200 bg-slate-50 p-5 sm:p-6">
              {updateMutation.error ? <ErrorPanel compact title="Preferences could not be saved" error={updateMutation.error} /> : null}
              {saved ? <SuccessBanner>Preferences saved for this demo workspace.</SuccessBanner> : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-500">{dirty ? "You have unsaved preference changes." : "Preferences are up to date."}</p><Button type="submit" disabled={!dirty || updateMutation.isPending || draft.default_follow_up_days < 1 || draft.default_follow_up_days > 30}>{updateMutation.isPending ? "Saving…" : "Save preferences"}</Button></div>
            </div>
          </form>
        ) : null}
      </section>

      <AccountControlsPreview />
    </div>
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

function AccountControlsPreview() {
  const exportMutation = useExportWorkspace();
  const [previewRole, setPreviewRole] = useState<PreviewRole>("CANDIDATE");
  const capabilities = [
    { icon: KeyRound, title: "Secure sign-in", description: "Password recovery and connected identity providers would be managed by the production identity service." },
    { icon: ShieldCheck, title: "Multi-factor authentication", description: "Persistent accounts could add verification and session controls without changing application ownership rules." },
    { icon: Bell, title: "Notification delivery", description: "Email and reminder delivery stays blocked in this demo until a real opt-in delivery system exists." },
  ];
  const role = PREVIEW_ROLES.find((item) => item.id === previewRole) ?? PREVIEW_ROLES[0];
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

  return <section className="space-y-6" aria-labelledby="account-preview-title">
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-panel">
      <div className="border-b border-slate-200 bg-gradient-to-r from-brand-50 via-slate-50 to-violet-50 p-5 sm:p-6"><span className="inline-flex rounded-full border border-brand-100 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-700">Production concept</span><h2 id="account-preview-title" className="mt-4 text-2xl font-bold text-slate-950">What a registered account could unlock</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Recruiters can see the account lifecycle a real product would support, while every demo-only boundary stays visible.</p></div>
      <div className="grid gap-px bg-slate-200 md:grid-cols-3">{capabilities.map(({ icon: Icon, title, description }) => <article key={title} className="bg-white p-5 sm:p-6"><span className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Icon aria-hidden="true" className="size-5" /></span><h3 className="mt-4 font-bold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></article>)}</div>
    </div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6" aria-labelledby="account-data-title"><div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Download aria-hidden="true" className="size-5" /></span><div><h3 id="account-data-title" className="text-xl font-bold text-slate-950">Your data, under your control</h3><p className="mt-1 text-sm leading-6 text-slate-600">Download the current workspace as portable JSON. It is generated from your owner-scoped API data and never includes another workspace.</p></div></div><div className="mt-5 flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-900">Workspace export</p><p className="text-sm text-slate-600">Applications, notes, interviews, activity, profile, and preferences.</p></div><Button onClick={() => void downloadExport()} disabled={exportMutation.isPending}>{exportMutation.isPending ? "Preparing…" : "Download JSON"}</Button></div>{exportMutation.error ? <div className="mt-4"><ErrorPanel compact title="Export could not be prepared" error={exportMutation.error} /></div> : null}{exportMutation.isSuccess ? <div className="mt-4"><SuccessBanner>Export downloaded. This file remains on your device only.</SuccessBanner></div> : null}</section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6" aria-labelledby="account-readiness-title"><h3 id="account-readiness-title" className="text-xl font-bold text-slate-950">Production-readiness preview</h3><p className="mt-1 text-sm leading-6 text-slate-600">A recruiter-facing checklist of what would become real with persistent accounts.</p><ul className="mt-5 space-y-3">{["Verified identity and recovery", "MFA and active-session controls", "Notification preferences", "Export and retention policy"].map((item) => <li key={item} className="flex items-start gap-3 text-sm text-slate-700"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" />{item}</li>)}</ul></section>
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6" aria-labelledby="role-preview-title"><div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><UsersRound aria-hidden="true" className="size-5" /></span><div><h3 id="role-preview-title" className="text-xl font-bold text-slate-950">Role & access preview</h3><p className="mt-1 text-sm leading-6 text-slate-600">Explore how a future account model could explain access without changing this demo identity or its permissions.</p></div></div><div className="mt-5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Preview role">{PREVIEW_ROLES.map((item) => <button key={item.id} type="button" role="radio" aria-checked={previewRole === item.id} onClick={() => setPreviewRole(item.id)} className={`min-h-11 rounded-xl border px-3 text-left text-sm font-semibold transition-colors ${previewRole === item.id ? "border-brand-400 bg-brand-50 text-brand-900" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>{item.label}</button>)}</div><div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="font-semibold text-slate-900">{role.label}</p><p className="mt-1 text-sm leading-6 text-slate-600">{role.description}</p><p className="mt-2 text-xs font-bold uppercase tracking-wide text-violet-700">Preview only · authorization unchanged</p></div></section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6" aria-labelledby="notification-preview-title"><div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><Mail aria-hidden="true" className="size-5" /></span><div><h3 id="notification-preview-title" className="text-xl font-bold text-slate-950">Email notifications</h3><p className="mt-1 text-sm leading-6 text-slate-600">Notification preferences are intentionally blocked until HireFlux has a real message-delivery service.</p></div></div><div className="mt-5 space-y-3">{([ ["followUps", "Follow-up reminders", "When a task reaches its due date."], ["interviews", "Interview reminders", "Before a scheduled conversation."], ["digest", "Weekly search digest", "A summary of movement and outcomes."] ] as const).map(([key, label, description]) => <label key={key} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-500"><input aria-label={label} type="checkbox" checked={false} disabled className="mt-1 size-4 accent-brand-600" /><span><span className="block text-sm font-semibold text-slate-700">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span></label>)}</div><p className="mt-4 flex items-center gap-2 text-xs font-semibold text-sky-700"><Bell aria-hidden="true" className="size-4" />Unavailable in this demo · no emails or messages are sent.</p></section>
    </div>
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950 sm:p-6"><strong>Demo boundary:</strong> passwords, MFA enrollment, email notification delivery, permission changes, permanent account deletion, and persistent login are intentionally unavailable. The export is the one active account-control action; the other items are clearly labeled previews.</div>
  </section>;
}

type PreviewRole = "CANDIDATE" | "RECRUITER" | "HIRING_MANAGER" | "ADMIN";

const PREVIEW_ROLES: ReadonlyArray<{ id: PreviewRole; label: string; description: string }> = [
  { id: "CANDIDATE", label: "Candidate", description: "Owns applications, interviews, notes, and personal search analytics." },
  { id: "RECRUITER", label: "Recruiter", description: "Would manage candidate pipelines and shared hiring workflows in a future product area." },
  { id: "HIRING_MANAGER", label: "Hiring manager", description: "Would review assigned candidates and interview feedback with scoped visibility." },
  { id: "ADMIN", label: "Administrator", description: "Would manage organization policy through a separately guarded administrative service." },
];

function SettingSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const id = `setting-${label.toLowerCase().replaceAll(" ", "-")}`;
  return <div><label htmlFor={id} className="text-sm font-semibold text-slate-800">{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800">{children}</select></div>;
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</dd></div>;
}
