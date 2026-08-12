import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { buttonClassName } from "../components/ui/buttonStyles";
import {
  ErrorPanel,
  LoadingState,
  SuccessBanner,
} from "../components/ui/Feedback";
import { StatusBadge } from "../components/ui/StatusBadge";
import { ActivityTimeline } from "../features/applications/ActivityTimeline";
import { ApplicationDetails } from "../features/applications/ApplicationDetails";
import { StatusTransitionForm } from "../features/applications/StatusTransitionForm";
import { formatTimestamp } from "../features/applications/format";
import { useApplication } from "../features/applications/queries";
import { InterviewsPanel } from "../features/resources/InterviewsPanel";
import { NotesPanel } from "../features/resources/NotesPanel";
import { useSettings } from "../features/resources/queries";

interface LocationState {
  notice?: string;
}

export function ApplicationDetailPage() {
  const { applicationId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [notice] = useState(
    () => (location.state as LocationState | null)?.notice ?? null,
  );
  const applicationQuery = useApplication(applicationId);
  const settingsQuery = useSettings();
  const timeZone = settingsQuery.data?.time_zone ?? "UTC";

  useEffect(() => {
    if (location.state) {
      void navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  if (applicationQuery.isPending) {
    return <LoadingState label="Loading application…" />;
  }

  if (applicationQuery.isError) {
    const isMissing =
      applicationQuery.error instanceof ApiError &&
      applicationQuery.error.status === 404;
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <ErrorPanel
          error={applicationQuery.error}
          title={isMissing ? "Application not found" : "Application could not be loaded"}
          onRetry={isMissing ? undefined : () => void applicationQuery.refetch()}
        />
        <Link to="/applications" className={buttonClassName("secondary")}>
          Back to applications
        </Link>
      </div>
    );
  }

  const application = applicationQuery.data;

  return (
    <div>
      <Link
        to="/applications"
        className="inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-brand-700 underline-offset-4 hover:underline"
      >
        ← Back to applications
      </Link>

      {notice ? (
        <div className="mt-3">
          <SuccessBanner>{notice}</SuccessBanner>
        </div>
      ) : null}

      <header className="mt-4 flex flex-col gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-bold text-brand-700">{application.company_name}</p>
            <StatusBadge status={application.status} />
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {application.job_title}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Updated <time dateTime={application.updated_at}>{formatTimestamp(application.updated_at, timeZone)}</time>
          </p>
        </div>
        <Link
          to={`/applications/${application.application_id}/edit`}
          className={buttonClassName("secondary")}
        >
          Edit details
        </Link>
      </header>

      {application.status === "ARCHIVED" ? (
        <div className="mt-6 rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm text-zinc-800">
          <p className="font-semibold">This application is archived.</p>
          <p className="mt-1 leading-6">
            It remains available in your history. Use the status control to restore it to its exact prior status.
          </p>
        </div>
      ) : null}

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ApplicationDetails application={application} />
        <StatusTransitionForm
          application={application}
          onReload={() => void applicationQuery.refetch()}
        />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <NotesPanel applicationId={application.application_id} timeZone={timeZone} />
        <InterviewsPanel applicationId={application.application_id} timeZone={timeZone} />
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-950">Activity</h2>
          <p className="mt-1 text-sm text-slate-600">
            A record of creation and status changes for this application.
          </p>
        </div>
        <ActivityTimeline applicationId={application.application_id} timeZone={timeZone} />
      </section>
    </div>
  );
}
