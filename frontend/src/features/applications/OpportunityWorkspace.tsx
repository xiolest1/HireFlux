import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
  Application,
  OpportunityGroup,
  OpportunityWorkspace as OpportunityWorkspaceData,
  OpportunityWorkspaceItem,
} from "../../api/schemas";
import { ErrorPanel } from "../../components/ui/Feedback";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { buttonClassName } from "../../components/ui/buttonStyles";
import { useOpportunityGroup } from "./queries";
import {
  opportunityActionLabel,
  opportunityReasonPresentation,
} from "./opportunityPresentation";
import { formatDateOnly, formatTimestamp } from "./format";

const sections: Array<{
  group: OpportunityGroup;
  title: string;
  description: string;
}> = [
  {
    group: "needs_action",
    title: "Needs your attention",
    description: "Candidate-owned actions and time-sensitive decisions.",
  },
  {
    group: "moving_forward",
    title: "Moving forward",
    description: "Opportunities with progress or a prepared interview ahead.",
  },
  {
    group: "waiting",
    title: "Waiting",
    description: "Opportunities where the next move currently belongs elsewhere.",
  },
];

export function OpportunityWorkspace({
  workspace,
  timeZone,
  highlightedApplicationId,
}: {
  workspace: OpportunityWorkspaceData;
  timeZone: string;
  highlightedApplicationId?: string;
}) {
  return (
    <div className="space-y-9">
      {sections.map((section) => {
        const page = workspace.groups[section.group];
        if (section.group !== "needs_action" && page.total_count === 0) return null;
        return (
          <OpportunitySection
            key={section.group}
            {...section}
            initialItems={page.items}
            totalCount={page.total_count}
            timeZone={timeZone}
            highlightedApplicationId={highlightedApplicationId}
          />
        );
      })}
    </div>
  );
}

function OpportunitySection({
  group,
  title,
  description,
  initialItems,
  totalCount,
  timeZone,
  highlightedApplicationId,
}: {
  group: OpportunityGroup;
  title: string;
  description: string;
  initialItems: OpportunityWorkspaceItem[];
  totalCount: number;
  timeZone: string;
  highlightedApplicationId?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const groupQuery = useOpportunityGroup(group, 20, expanded);
  const items = useMemo(() => {
    if (!expanded) return initialItems;
    const byId = new Map<string, OpportunityWorkspaceItem>();
    for (const item of initialItems) byId.set(item.application.application_id, item);
    for (const page of groupQuery.data?.pages ?? []) {
      for (const item of page.items) byId.set(item.application.application_id, item);
    }
    return Array.from(byId.values());
  }, [expanded, groupQuery.data?.pages, initialItems]);
  const regionId = `opportunity-group-${group}`;

  return (
    <section aria-labelledby={`${regionId}-title`} aria-describedby={`${regionId}-description`}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id={`${regionId}-title`} className="text-xl font-bold text-ink sm:text-2xl">
              {title}
            </h2>
            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-bold text-ink-muted">
              {totalCount}
            </span>
          </div>
          <p id={`${regionId}-description`} className="mt-1 text-sm text-ink-muted">
            {description} {totalCount} {totalCount === 1 ? "opportunity" : "opportunities"}.
          </p>
        </div>
      </div>

      {group === "needs_action" && totalCount === 0 ? (
        <div className="mt-4 rounded-2xl border border-line bg-surface px-5 py-6">
          <p className="font-semibold text-ink">Nothing needs your attention right now.</p>
          <p className="mt-1 text-sm text-ink-muted">Your moving and waiting opportunities remain below.</p>
        </div>
      ) : (
        <div id={regionId} className={group === "needs_action" ? "mt-4 grid gap-4 lg:grid-cols-2" : "mt-2 divide-y divide-line"}>
          {items.map((item, index) => (
            <div key={item.application.application_id} className={!expanded && index === 3 ? "hidden sm:block" : ""}>
              {group === "needs_action" ? (
                <PriorityOpportunity item={item} timeZone={timeZone} highlighted={item.application.application_id === highlightedApplicationId} />
              ) : (
                <CompactOpportunity item={item} timeZone={timeZone} highlighted={item.application.application_id === highlightedApplicationId} />
              )}
            </div>
          ))}
        </div>
      )}

      {groupQuery.isError ? (
        <div className="mt-4">
          <ErrorPanel compact title={`More ${title.toLowerCase()} opportunities could not be loaded`} error={groupQuery.error} onRetry={() => void groupQuery.refetch()} />
        </div>
      ) : null}
      {expanded && groupQuery.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <button className={buttonClassName("secondary")} disabled={groupQuery.isFetchingNextPage} onClick={() => void groupQuery.fetchNextPage()}>
            {groupQuery.isFetchingNextPage ? "Loading more…" : "Load more"}
          </button>
        </div>
      ) : null}
      {totalCount > 3 ? (
        <button
          type="button"
          className={`mt-3 min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-accent hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${totalCount === 4 ? "inline-flex sm:hidden" : "inline-flex"}`}
          aria-expanded={expanded}
          aria-controls={regionId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
          {expanded ? `Show fewer ${title.toLowerCase()}` : `View all ${totalCount}`}
        </button>
      ) : null}
    </section>
  );
}

function PriorityOpportunity({ item, timeZone, highlighted }: RowProps) {
  const presentation = opportunityReasonPresentation[item.classification.reason_code];
  const Icon = presentation.icon;
  const destination = actionDestination(item);
  return (
    <article className={`min-w-0 rounded-2xl border bg-surface p-5 shadow-sm ${highlighted ? "border-accent ring-2 ring-accent/20" : "border-line"}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-xl bg-accent-soft p-2 text-accent"><Icon aria-hidden="true" className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-muted">{item.application.company_name}</p>
          <Link to={`/applications/${item.application.application_id}`} className="mt-1 inline-flex min-h-11 max-w-full items-center [overflow-wrap:anywhere] text-lg font-bold leading-tight text-ink hover:text-accent hover:underline">
            {item.application.job_title}
          </Link>
          <p className="mt-2 font-semibold text-ink">{presentation.label}</p>
          <p className="mt-1 text-sm leading-6 text-ink-muted">{presentation.description}</p>
          <SupportingValue item={item} timeZone={timeZone} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <StatusBadge status={item.application.status} />
            <Link to={destination} className={buttonClassName("primary", "min-h-11")}>
              {opportunityActionLabel[item.classification.action_type]}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function CompactOpportunity({ item, timeZone, highlighted }: RowProps) {
  const presentation = opportunityReasonPresentation[item.classification.reason_code];
  return (
    <article className={`flex min-w-0 flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between ${highlighted ? "rounded-xl bg-accent-soft px-3" : ""}`}>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink-muted">{item.application.company_name}</p>
        <Link to={`/applications/${item.application.application_id}`} className="inline-flex min-h-11 max-w-full items-center [overflow-wrap:anywhere] font-bold text-ink hover:text-accent hover:underline">
          {item.application.job_title}
        </Link>
      </div>
      <div className="min-w-0 sm:max-w-[48%] sm:text-right">
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <StatusBadge status={item.application.status} />
          <span className="text-sm font-semibold text-ink">{presentation.label}</span>
        </div>
        <SupportingValue item={item} timeZone={timeZone} />
      </div>
    </article>
  );
}

interface RowProps {
  item: OpportunityWorkspaceItem;
  timeZone: string;
  highlighted: boolean;
}

function SupportingValue({ item, timeZone }: Pick<RowProps, "item" | "timeZone">) {
  const value = item.classification.relevant_at
    ? formatTimestamp(item.classification.relevant_at, timeZone)
    : item.classification.relevant_date
      ? formatDateOnly(item.classification.relevant_date)
      : null;
  return value ? <p className="mt-1 text-sm text-ink-muted">{value}</p> : null;
}

function actionDestination(item: OpportunityWorkspaceItem): string {
  if (
    (item.classification.action_type === "PREPARE_INTERVIEW" ||
      item.classification.action_type === "RESOLVE_INTERVIEW") &&
    item.classification.interview_id
  ) {
    return `/interviews?interview=${encodeURIComponent(item.classification.interview_id)}`;
  }
  return `/applications/${item.application.application_id}`;
}

export function FlatOpportunityRow({
  application,
  highlighted = false,
}: {
  application: Application;
  highlighted?: boolean;
}) {
  const supporting = flatSupportingText(application);
  return (
    <li className={`border-b border-line py-4 last:border-b-0 ${highlighted ? "rounded-xl bg-accent-soft px-3" : ""}`}>
      <article className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-muted">{application.company_name}</p>
          <Link to={`/applications/${application.application_id}`} className="inline-flex min-h-11 max-w-full items-center [overflow-wrap:anywhere] font-bold text-ink hover:text-accent hover:underline">
            {application.job_title}
          </Link>
        </div>
        <div className="sm:max-w-[48%] sm:text-right">
          <StatusBadge status={application.status} />
          <p className="mt-1 text-sm text-ink-muted">{supporting}</p>
        </div>
      </article>
    </li>
  );
}

function flatSupportingText(application: Application): string {
  if (application.next_step_responsibility === "CANDIDATE") {
    return application.next_step_note ?? "Candidate action planned";
  }
  if (application.next_step_responsibility === "EMPLOYER") return "Waiting for employer";
  if (application.follow_up_date) return `Check back ${formatDateOnly(application.follow_up_date)}`;
  return application.applied_date ? `Applied ${formatDateOnly(application.applied_date)}` : "Draft opportunity";
}
