import { Link, useNavigate, useParams } from "react-router-dom";
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

export function ApplicationEditPage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const applicationQuery = useApplication(applicationId);
  const updateMutation = useUpdateApplication();

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
        mode="edit"
        application={application}
        isSubmitting={updateMutation.isPending}
        serverError={updateMutation.error}
        onSubmit={submit}
      />
    </div>
  );
}
