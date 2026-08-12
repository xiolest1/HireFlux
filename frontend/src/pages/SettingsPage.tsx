import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { ColorTheme, DashboardRange, Settings } from "../api/schemas";
import { useDemoSession } from "../auth/demoSessionContext";
import { Button } from "../components/ui/Button";
import { ErrorPanel, LoadingState, SuccessBanner } from "../components/ui/Feedback";
import { setColorThemePreference } from "../components/ui/themePreference";
import { useMe } from "../features/applications/queries";
import { formatTimestamp } from "../features/applications/format";
import { useSettings, useUpdateSettings } from "../features/resources/queries";

type SettingsDraft = Omit<Settings, "created_at" | "updated_at" | "version">;

const TIME_ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function SettingsPage() {
  const settingsQuery = useSettings();
  const updateMutation = useUpdateSettings();
  const meQuery = useMe();
  const { session } = useDemoSession();
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) {
      const { time_zone, default_follow_up_days, default_application_view, default_dashboard_range, theme } = settingsQuery.data;
      setDraft({ time_zone, default_follow_up_days, default_application_view, default_dashboard_range, theme });
    }
  }, [settingsQuery.data]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || !settingsQuery.data) return;
    setSaved(false);
    try {
      await updateMutation.mutateAsync({
        expected_version: settingsQuery.data.version,
        ...draft,
      });
      setColorThemePreference(draft.theme);
      setSaved(true);
    } catch {
      return;
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">Workspace preferences</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Settings & profile</h1>
        <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
          Personalize this temporary workspace and preview how registered-account controls would fit the product.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6" aria-labelledby="preferences-title">
          <h2 id="preferences-title" className="text-xl font-bold text-slate-950">Demo preferences</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">These settings persist only for this isolated 24-hour workspace.</p>
          {settingsQuery.isPending || !draft ? <div className="mt-5"><LoadingState label="Loading preferences…" /></div> : null}
          {settingsQuery.isError ? <div className="mt-5"><ErrorPanel compact error={settingsQuery.error} onRetry={() => void settingsQuery.refetch()} /></div> : null}
          {draft && settingsQuery.data ? (
            <form className="mt-6 space-y-5" onSubmit={submit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <SettingSelect label="Time zone" value={draft.time_zone} onChange={(value) => setDraft({ ...draft, time_zone: value })}>
                  {TIME_ZONES.map((zone) => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}
                </SettingSelect>
                <div>
                  <label htmlFor="follow-up-days" className="text-sm font-semibold text-slate-800">Default follow-up interval</label>
                  <div className="relative mt-2">
                    <input id="follow-up-days" type="number" min={1} max={30} value={draft.default_follow_up_days} onChange={(event) => setDraft({ ...draft, default_follow_up_days: Number(event.target.value) })} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 pr-14 text-slate-900" />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">days</span>
                  </div>
                </div>
                <SettingSelect label="Default application view" value={draft.default_application_view} onChange={(value) => setDraft({ ...draft, default_application_view: value as SettingsDraft["default_application_view"] })}>
                  <option value="ACTIVE">Active pursuits</option><option value="ALL">All applications</option><option value="ARCHIVED">Archived</option>
                </SettingSelect>
                <SettingSelect label="Default dashboard range" value={draft.default_dashboard_range} onChange={(value) => setDraft({ ...draft, default_dashboard_range: value as DashboardRange })}>
                  <option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="all">All time</option>
                </SettingSelect>
                <SettingSelect label="Color theme" value={draft.theme} onChange={(value) => setDraft({ ...draft, theme: value as ColorTheme })}>
                  <option value="SYSTEM">Use system preference</option><option value="LIGHT">Light</option><option value="DARK">Dark</option>
                </SettingSelect>
              </div>
              {updateMutation.error ? <ErrorPanel compact title="Preferences could not be saved" error={updateMutation.error} /> : null}
              {saved ? <SuccessBanner>Preferences saved for this demo workspace.</SuccessBanner> : null}
              <div className="flex justify-end border-t border-slate-100 pt-5"><Button type="submit" disabled={updateMutation.isPending || draft.default_follow_up_days < 1 || draft.default_follow_up_days > 30}>{updateMutation.isPending ? "Saving…" : "Save preferences"}</Button></div>
            </form>
          ) : null}
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel" aria-labelledby="profile-title">
            <h2 id="profile-title" className="text-lg font-bold text-slate-950">Profile</h2>
            {meQuery.isPending ? <p className="mt-4 text-sm text-slate-600" role="status">Loading profile…</p> : null}
            {meQuery.data ? <dl className="mt-4 space-y-4"><ProfileItem label="Name" value={meQuery.data.name} /><ProfileItem label="Email" value={meQuery.data.email} /><ProfileItem label="Account type" value="Isolated demo" /><ProfileItem label="Workspace expires" value={session ? formatTimestamp(session.expires_at, settingsQuery.data?.time_zone ?? "UTC") : "Not available"} /></dl> : null}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel" aria-labelledby="registered-title">
            <div className="flex items-center justify-between gap-3"><h2 id="registered-title" className="text-lg font-bold text-slate-950">Registered account</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">Preview</span></div>
            <p className="mt-2 text-sm leading-6 text-slate-600">These production account controls are intentionally unavailable in the temporary demo.</p>
            <div className="mt-4 grid gap-2">
              {['Change password', 'Multi-factor authentication', 'Connected sign-ins', 'Notification delivery', 'Export account data'].map((label) => <button key={label} type="button" disabled className="min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-sm font-semibold text-slate-400 disabled:cursor-not-allowed">{label}</button>)}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SettingSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const id = `setting-${label.toLowerCase().replaceAll(" ", "-")}`;
  return <div><label htmlFor={id} className="text-sm font-semibold text-slate-800">{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800">{children}</select></div>;
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</dd></div>;
}
