import { useEffect } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ApiError } from "../api/client";
import { buttonClassName } from "../components/ui/buttonStyles";
import { ErrorPanel } from "../components/ui/Feedback";
import { ApplicationForm } from "../features/applications/ApplicationForm";
import { PageHeader } from "../components/ui/PageHeader";
import { ChevronLeft } from "lucide-react";
import { ApplicationFormSkeleton } from "../features/applications/ApplicationSkeletons";
import {
  toApplicationFields,
  type ApplicationFormValues,
} from "../features/applications/formSchema";
import {
  useApplication,
  useUpdateApplication,
} from "../features/applications/queries";
import { useSettings } from "../features/resources/queries";

export function ApplicationEditPage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const applicationQuery = useApplication(applicationId);
  const updateMutation = useUpdateApplication();
  const settingsQuery = useSettings();

  useEffect(() => {
    if (!applicationQuery.isSuccess || searchParams.get("focus") !== "follow_up") {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const followUpField = document.getElementById("follow_up_date");
      if (typeof followUpField?.scrollIntoView === "function") {
        followUpField.scrollIntoView({ block: "center" });
      }
      followUpField?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [applicationQuery.isSuccess, searchParams]);

  if (applicationQuery.isPending) {
    return <ApplicationFormSkeleton label="Loading application…" />;
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

  async function submit(values: ApplicationFormValues) {
    try {
      const updated = await updateMutation.mutateAsync({
        applicationId: application.application_id,
        request: {
          ...toApplicationFields(values),
          expected_version: application.version,
        },
      });
      navigate(`/applications/${updated.application_id}`, {
        replace: true,
        state: { notice: "Application details updated." },
      });
    } catch {
      return;
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to={`/applications/${application.application_id}`}
        className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-semibold text-accent underline-offset-4 hover:underline"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Back to application
      </Link>
      <PageHeader
        className="mb-8 mt-3"
        eyebrow={application.company_name}
        title={`Edit ${application.job_title}`}
        description="Update the opportunity details here. Status changes remain in the application workspace."
      />

      <ApplicationForm
        application={application}
        timeZone={settingsQuery.data?.time_zone}
        isSubmitting={updateMutation.isPending}
        serverError={updateMutation.error}
        onSubmit={submit}
      />
    </div>
  );
}
