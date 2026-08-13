import { EmptyState, ErrorPanel } from "../../components/ui/Feedback";
import { ResourcePanelSkeleton } from "./ApplicationSkeletons";
import { formatTimestamp } from "./format";
import { useApplicationActivity } from "./queries";

function formatActivityType(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ActivityTimeline({
  applicationId,
  timeZone,
}: {
  applicationId: string;
  timeZone: string;
}) {
  const activityQuery = useApplicationActivity(applicationId);

  if (activityQuery.isPending) {
    return <ResourcePanelSkeleton label="Loading activity…" />;
  }

  if (activityQuery.isError) {
    return (
      <ErrorPanel
        compact
        error={activityQuery.error}
        title="Activity could not be loaded"
        onRetry={() => void activityQuery.refetch()}
      />
    );
  }

  if (activityQuery.data.items.length === 0) {
    return (
      <EmptyState
        title="No activity recorded"
        description="Creation and status changes will appear here."
      />
    );
  }

  return (
    <ol className="relative ml-2 border-l border-line pl-6">
      {activityQuery.data.items.map((activity) => (
        <li key={activity.activity_id} className="relative pb-6 last:pb-0">
          <span
            aria-hidden="true"
            className="absolute -left-[1.81rem] top-1.5 size-3 rounded-full border-2 border-surface bg-accent ring-1 ring-accent/30"
          />
          <p className="text-sm font-semibold text-ink">{activity.summary}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
            <span>{formatActivityType(activity.activity_type)}</span>
            <span aria-hidden="true">•</span>
            <time dateTime={activity.created_at}>
              {formatTimestamp(activity.created_at, timeZone)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
