import { Link, useNavigate } from "react-router-dom";
import { ApplicationForm } from "../features/applications/ApplicationForm";
import {
  toCreateApplicationRequest,
  type ApplicationFormValues,
} from "../features/applications/formSchema";
import { useCreateApplication } from "../features/applications/queries";
import { useSettings } from "../features/resources/queries";
import { LoadingState } from "../components/ui/Feedback";

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
    return <LoadingState label="Preparing application defaults…" />;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to="/applications"
        className="inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-brand-700 underline-offset-4 hover:underline"
      >
        ← Back to applications
      </Link>
      <div className="mb-8 mt-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">
          Add an application
        </h1>
        <p className="mt-2 text-base leading-7 text-slate-600">
          Start with the essentials. You can update details and status at any time.
        </p>
      </div>

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
