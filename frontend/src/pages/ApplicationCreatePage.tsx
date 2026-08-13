import { Link, useNavigate } from "react-router-dom";
import { ApplicationForm } from "../features/applications/ApplicationForm";
import {
  toCreateApplicationRequest,
  type ApplicationFormValues,
} from "../features/applications/formSchema";
import { useCreateApplication } from "../features/applications/queries";
import { useSettings } from "../features/resources/queries";
import { PageHeader } from "../components/ui/PageHeader";
import { ChevronLeft } from "lucide-react";
import { ApplicationFormSkeleton } from "../features/applications/ApplicationSkeletons";

export function ApplicationCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateApplication();
  const settingsQuery = useSettings();

  async function submit(values: ApplicationFormValues) {
    try {
      const application = await createMutation.mutateAsync(
        toCreateApplicationRequest(values),
      );
      navigate(`/applications/${application.application_id}`, {
        replace: true,
        state: { notice: "Application created." },
      });
    } catch {
      return;
    }
  }

  if (settingsQuery.isPending) {
    return <ApplicationFormSkeleton label="Preparing application defaults…" />;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to="/applications"
        className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-semibold text-accent underline-offset-4 hover:underline"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Back to applications
      </Link>
      <PageHeader
        className="mb-8 mt-3"
        eyebrow="New opportunity"
        title="Add an application"
        description="Start with the essentials. You can add optional context now or return to it later."
      />

      <ApplicationForm
        mode="create"
        defaultPreferences={
          settingsQuery.data
            ? {
                defaultFollowUpDays: settingsQuery.data.default_follow_up_days,
                timeZone: settingsQuery.data.time_zone,
              }
            : undefined
        }
        isSubmitting={createMutation.isPending}
        serverError={createMutation.error}
        onSubmit={submit}
      />
    </div>
  );
}
