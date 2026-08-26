import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { Application } from "../api/schemas";
import { ErrorPanel, SuccessBanner } from "../components/ui/Feedback";
import { ApplicationCreateForm } from "../features/applications/ApplicationCreateForm";
import {
  toCreateApplicationRequest,
  type ApplicationCreateFormValues,
} from "../features/applications/formSchema";
import { readApplicationCreateRouteState } from "../features/applications/createNavigation";
import { useCreateApplication } from "../features/applications/queries";
import { useSettings } from "../features/resources/queries";
import { PageHeader } from "../components/ui/PageHeader";
import { ChevronLeft } from "lucide-react";
import { ApplicationFormSkeleton } from "../features/applications/ApplicationSkeletons";

export function ApplicationCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const createMutation = useCreateApplication();
  const settingsQuery = useSettings();
  const [createdApplication, setCreatedApplication] = useState<Application | null>(null);
  const routeState = readApplicationCreateRouteState(location.state);

  async function submit(values: ApplicationCreateFormValues): Promise<boolean> {
    try {
      const application = await createMutation.mutateAsync(
        toCreateApplicationRequest(values),
      );
      if (routeState) {
        navigate(routeState.returnTo, {
          replace: true,
          state: {
            notice: `${application.job_title} at ${application.company_name} was added.`,
            createdApplicationId: application.application_id,
            createdCompanyName: application.company_name,
            createdJobTitle: application.job_title,
          },
        });
        return false;
      }
      setCreatedApplication(application);
      return true;
    } catch {
      return false;
    }
  }

  if (settingsQuery.isPending) {
    return <ApplicationFormSkeleton label="Preparing application defaults…" />;
  }

  if (settingsQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <ErrorPanel
          error={settingsQuery.error}
          title="Application defaults could not be loaded"
          onRetry={() => void settingsQuery.refetch()}
        />
        <Link to={routeState?.returnTo ?? "/applications"} className="font-semibold text-accent hover:underline">
          Return to {routeState?.origin === "dashboard" ? "dashboard" : "applications"}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to={routeState?.returnTo ?? "/applications"}
        className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-semibold text-accent underline-offset-4 hover:underline"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Back to {routeState?.origin === "dashboard" ? "dashboard" : "applications"}
      </Link>
      <PageHeader
        className="mb-7 mt-3"
        eyebrow="Quick capture"
        title="Add an application"
        description="Tell HireFlux what job you’re tracking. We’ll help you manage what comes next."
      />

      {createdApplication ? (
        <div className="mb-5">
          <SuccessBanner>
            <span className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {createdApplication.job_title} at {createdApplication.company_name} was added. The form is ready for another opportunity.
              </span>
              <Link
                to={`/applications/${createdApplication.application_id}`}
                className="font-semibold underline underline-offset-4"
              >
                View application
              </Link>
            </span>
          </SuccessBanner>
        </div>
      ) : null}

      <ApplicationCreateForm
        timeZone={settingsQuery.data?.time_zone ?? "UTC"}
        isSubmitting={createMutation.isPending}
        serverError={createMutation.error}
        onSubmit={submit}
      />
    </div>
  );
}
