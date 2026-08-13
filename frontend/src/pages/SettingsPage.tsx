import { Bell, Clock3, KeyRound, Palette, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ColorTheme, DashboardRange, Settings } from "../api/schemas";
import { useDemoSession } from "../auth/demoSessionContext";
import { Button } from "../components/ui/Button";
import { ErrorPanel, SuccessBanner } from "../components/ui/Feedback";
import { Skeleton } from "../components/ui/Skeleton";
import { setColorThemePreference } from "../components/ui/themePreference";
import { formatTimestamp } from "../features/applications/format";
import { useMe } from "../features/applications/queries";
import { useSettings, useUpdateSettings } from "../features/resources/queries";

type SettingsDraft = Omit<Settings, "created_at" | "updated_at" | "version">;
const TIME_ZONES = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"];

function draftFromSettings(settings: Settings): SettingsDraft {
  const { time_zone, default_follow_up_days, default_application_view, default_dashboard_range, theme } = settings;
  return { time_zone, default_follow_up_days, default_application_view, default_dashboard_range, theme };
}

function draftsMatch(left: SettingsDraft | null, right: SettingsDraft | null) {
  if (!left || !right) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function SettingsPage() {
  const [searchParams] = useSearchParams();
  const section = (["preferences", "workspace", "account"] as const).find((value) => value === searchParams.get("section")) ?? "preferences";
  const settingsQuery = useSettings();
  const updateMutation = useUpdateSettings();
  const meQuery = useMe();
  const { session } = useDemoSession();
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) setDraft(draftFromSettings(settingsQuery.data));
  }, [settingsQuery.data]);

  const original = settingsQuery.data ? draftFromSettings(settingsQuery.data) : null;
  const dirty = !draftsMatch(draft, original);

  function change(next: SettingsDraft) {
    setDraft(next);
    setSaved(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || !settingsQuery.data || !dirty) return;
    setSaved(false);
    try {
      await updateMutation.mutateAsync({ expected_version: settingsQuery.data.version, ...draft });
      setColorThemePreference(draft.theme);
      setSaved(true);
    } catch {
      return;
    }
  }

  return (
    <div className="space-y-7">
      <header>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">Workspace controls</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Settings & profile</h1>
        <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">Personalize this temporary workspace and preview how a registered account would grow with the product.</p>
      </header>

      <nav aria-label="Settings sections" className="grid w-full grid-cols-3 rounded-xl bg-slate-100 p-1 sm:inline-flex sm:w-auto">
        {([[
          "preferences", "Preferences"], ["workspace", "Demo workspace"], ["account", "Account preview"]] as const).map(([value, label]) => {
          const next = new URLSearchParams(searchParams);
          if (value === "preferences") next.delete("section"); else next.set("section", value);
          const mobileLabel = value === "workspace" ? "Workspace" : value === "account" ? "Account" : label;
          return <Link key={value} to={`?${next.toString()}`} replace aria-label={label} aria-current={section === value ? "page" : undefined} className={`flex min-h-10 min-w-0 flex-1 items-center justify-center rounded-lg px-2 text-center text-xs font-semibold transition-colors sm:flex-none sm:px-4 sm:text-sm ${section === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950"}`}><span className="sm:hidden">{mobileLabel}</span><span className="hidden sm:inline">{label}</span></Link>;
        })}
      </nav>

      {section === "preferences" ? (
        <section className="rounded-3xl border border-slate-200 bg-white shadow-panel" aria-labelledby="preferences-title">
          <div className="border-b border-slate-200 p-5 sm:p-6"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Palette aria-hidden="true" className="size-5" /></span><div><h2 id="preferences-title" className="text-xl font-bold text-slate-950">Demo preferences</h2><p className="mt-1 text-sm leading-6 text-slate-600">These settings persist only for this isolated 24-hour workspace.</p></div></div></div>
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
      ) : null}

      {section === "workspace" ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6" aria-labelledby="workspace-profile-title"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><UserRound aria-hidden="true" className="size-5" /></span><div><h2 id="workspace-profile-title" className="text-xl font-bold text-slate-950">Demo identity</h2><p className="mt-1 text-sm leading-6 text-slate-600">Fictional profile data scoped to this isolated workspace.</p></div></div>{meQuery.isPending ? <p className="mt-6 text-sm text-slate-600" role="status">Loading profile…</p> : null}{meQuery.isError ? <div className="mt-6"><ErrorPanel compact error={meQuery.error} onRetry={() => void meQuery.refetch()} /></div> : null}{meQuery.data ? <dl className="mt-6 grid gap-5 sm:grid-cols-2"><ProfileItem label="Name" value={meQuery.data.name} /><ProfileItem label="Email" value={meQuery.data.email} /><ProfileItem label="Account type" value="Isolated demo" /><ProfileItem label="Role" value="Standard user" /></dl> : null}</section>
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-panel" aria-labelledby="workspace-lifecycle-title"><div className="bg-gradient-to-br from-brand-600 to-violet-700 p-5 text-white sm:p-6"><Clock3 aria-hidden="true" className="size-7" /><h2 id="workspace-lifecycle-title" className="mt-4 text-xl font-bold">Temporary by design</h2><p className="mt-2 text-sm leading-6 text-blue-50">Every recruiter gets a separate environment with fictional data. Nothing is shared with another visitor.</p></div><dl className="space-y-4 p-5 sm:p-6"><ProfileItem label="Workspace expires" value={session ? formatTimestamp(session.expires_at, settingsQuery.data?.time_zone ?? "UTC") : "Not available"} /><ProfileItem label="Data lifetime" value="24 hours" /><ProfileItem label="Persistence" value="This browser session only" /></dl></section>
        </div>
      ) : null}

      {section === "account" ? <AccountPreview /> : null}
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

function AccountPreview() {
  const capabilities = [
    { icon: KeyRound, title: "Secure sign-in", description: "Password recovery and connected identity providers would be managed by the production identity service." },
    { icon: ShieldCheck, title: "Multi-factor authentication", description: "Persistent accounts could add verification and session controls without changing application ownership rules." },
    { icon: Bell, title: "Notification delivery", description: "Email and reminder preferences would live here after an opt-in delivery system is available." },
  ];
  return <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-panel" aria-labelledby="account-preview-title"><div className="border-b border-slate-200 bg-gradient-to-r from-brand-50 via-white to-violet-50 p-5 sm:p-6"><span className="inline-flex rounded-full border border-brand-100 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-700">Production concept</span><h2 id="account-preview-title" className="mt-4 text-2xl font-bold text-slate-950">What a registered account could unlock</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">This panel explains future capabilities without presenting controls that cannot work in the temporary demo.</p></div><div className="grid gap-px bg-slate-200 md:grid-cols-3">{capabilities.map(({ icon: Icon, title, description }) => <article key={title} className="bg-white p-5 sm:p-6"><span className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Icon aria-hidden="true" className="size-5" /></span><h3 className="mt-4 font-bold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></article>)}</div><div className="border-t border-slate-200 p-5 text-sm leading-6 text-slate-600 sm:p-6"><strong className="text-slate-900">Not part of this demo:</strong> passwords, MFA enrollment, notifications, permanent exports, and account deletion are intentionally unavailable.</div></section>;
}

function SettingSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const id = `setting-${label.toLowerCase().replaceAll(" ", "-")}`;
  return <div><label htmlFor={id} className="text-sm font-semibold text-slate-800">{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800">{children}</select></div>;
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</dd></div>;
}
