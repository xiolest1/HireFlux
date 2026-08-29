import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
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
  flatOpportunitySupportingText,
  opportunityActionText,
  opportunityReasonPresentation,
  opportunitySupportingText,
} from "./opportunityPresentation";
import {
  applicationsRouteState,
  type ApplicationsDownstreamIntent,
} from "./opportunityNavigation";
import { formatStatus } from "./format";

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
  const location = useLocation();
  const returnPath = `${location.pathname}${location.search}`;
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
        <div className="mt-4">
          <p className="font-semibold text-ink">Nothing needs your attention right now.</p>
          <p className="mt-1 text-sm text-ink-muted">Your moving and waiting opportunities are ready below.</p>
        </div>
      ) : (
        <div id={regionId} className={group === "needs_action" ? "mt-4" : "mt-1 divide-y divide-line border-b border-line"}>
          {(expanded ? items : items.slice(0, 3)).map((item, index) => (
            <div key={item.application.application_id}>
              {group === "needs_action" ? (
                index === 0 ? (
                  <PriorityOpportunity item={item} timeZone={timeZone} returnPath={returnPath} highlighted={item.application.application_id === highlightedApplicationId} />
                ) : (
                  <AttentionOpportunity item={item} timeZone={timeZone} returnPath={returnPath} highlighted={item.application.application_id === highlightedApplicationId} />
                )
              ) : (
                <CompactOpportunity item={item} timeZone={timeZone} returnPath={returnPath} highlighted={item.application.application_id === highlightedApplicationId} />
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
          className={`mt-3 min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-accent hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${totalCount === 4 ? "inline-flex sm:hidden" : "inline-flex"}`}
          aria-expanded={expanded}
          aria-controls={regionId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
          {expanded ? `Show fewer ${title.toLowerCase()}` : `Show ${totalCount - 3} more ${title.toLowerCase()}`}
        </button>
      ) : null}
    </section>
  );
}

function PriorityOpportunity({ item, timeZone, returnPath, highlighted }: RowProps) {
  const presentation = opportunityReasonPresentation[item.classification.reason_code];
  const Icon = presentation.icon;
  const destination = actionDestination(item);
  const state = actionRouteState(item, returnPath);
  return (
    <article className={`min-w-0 rounded-2xl border bg-surface-raised p-5 ${highlighted ? "border-accent bg-surface-selected ring-2 ring-focus/20" : "border-line-subtle"}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-xl bg-accent-soft p-2 text-accent"><Icon aria-hidden="true" className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{presentation.label}</p>
          <p className="mt-3 truncate text-sm font-semibold text-ink-muted">{item.application.company_name}</p>
          <Link to={`/applications/${item.application.application_id}`} state={applicationsRouteState("/applications", returnPath.slice("/applications".length))} className="mt-1 inline-flex min-h-11 max-w-full items-center [overflow-wrap:anywhere] text-lg font-bold leading-tight text-ink hover:text-accent hover:underline">
            {item.application.job_title}
          </Link>
          <SupportingValue item={item} timeZone={timeZone} />
          <p className="mt-1 text-sm leading-6 text-ink-muted">{presentation.description}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-ink-muted">{formatStatus(item.application.status)}</span>
            <Link to={destination} state={state} className={buttonClassName("primary", "min-h-11")}>
              {opportunityActionText(item)}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function AttentionOpportunity({ item, timeZone, returnPath, highlighted }: RowProps) {
  const presentation = opportunityReasonPresentation[item.classification.reason_code];
  return (
    <article className={`flex min-w-0 flex-col gap-3 border-b border-line-subtle py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between ${highlighted ? "rounded-xl bg-surface-selected px-3" : ""}`}>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink-muted">{item.application.company_name}</p>
        <Link to={`/applications/${item.application.application_id}`} state={applicationsRouteState("/applications", returnPath.slice("/applications".length))} className="inline-flex min-h-11 max-w-full items-center [overflow-wrap:anywhere] font-bold text-ink hover:text-accent hover:underline">
          {item.application.job_title}
        </Link>
        <p className="text-sm font-semibold text-ink">{presentation.label}</p>
        <SupportingValue item={item} timeZone={timeZone} />
      </div>
      <Link to={actionDestination(item)} state={actionRouteState(item, returnPath)} className={buttonClassName("secondary", "min-h-11 shrink-0")}>
        {opportunityActionText(item)}
      </Link>
    </article>
  );
}

function CompactOpportunity({ item, timeZone, returnPath, highlighted }: RowProps) {
  const presentation = opportunityReasonPresentation[item.classification.reason_code];
  return (
    <article className={`grid min-w-0 gap-3 px-1 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,0.8fr)] sm:items-center sm:px-2 ${highlighted ? "rounded-xl bg-surface-selected !px-3" : ""}`}>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink-muted">{item.application.company_name}</p>
        <Link to={`/applications/${item.application.application_id}`} state={applicationsRouteState("/applications", returnPath.slice("/applications".length))} className="inline-flex min-h-11 max-w-full items-center [overflow-wrap:anywhere] font-bold text-ink hover:text-accent hover:underline">
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
  returnPath: string;
  highlighted: boolean;
}

function SupportingValue({ item, timeZone }: Pick<RowProps, "item" | "timeZone">) {
  const value = opportunitySupportingText(item, timeZone);
  return value ? <p className="mt-1 text-sm text-ink-muted">{value}</p> : null;
}

function actionRouteState(item: OpportunityWorkspaceItem, returnPath: string) {
  let intent: ApplicationsDownstreamIntent | undefined;
  if (item.classification.action_type === "PREPARE_INTERVIEW") {
    intent = "OPEN_INTERVIEW_PREPARATION";
  } else if (
    item.classification.action_type === "REVIEW_FOLLOW_UP" ||
    item.classification.action_type === "REVIEW_OFFER" ||
    item.classification.reason_code === "CANDIDATE_ACTION_UPCOMING" ||
    item.classification.reason_code === "CANDIDATE_ACTION_UNSCHEDULED"
  ) {
    intent = "RUN_PRIMARY_ACTION";
  }
  return applicationsRouteState(
    "/applications",
    returnPath.slice("/applications".length),
    intent,
  );
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
  returnPath,
  highlighted = false,
}: {
  application: Application;
  returnPath: string;
  highlighted?: boolean;
}) {
  const supporting = flatOpportunitySupportingText(application);
  return (
    <li className={`border-b border-line-subtle py-4 last:border-b-0 ${highlighted ? "rounded-xl bg-surface-selected px-3" : ""}`}>
      <article className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-muted">{application.company_name}</p>
          <Link to={`/applications/${application.application_id}`} state={applicationsRouteState("/applications", returnPath.slice("/applications".length))} className="inline-flex min-h-11 max-w-full items-center [overflow-wrap:anywhere] font-bold text-ink hover:text-accent hover:underline">
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
