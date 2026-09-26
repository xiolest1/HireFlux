import type { OpportunityWorkspace } from "../../api/schemas";
import type { Dashboard } from "../../api/workspace";

export type HomeAction = Dashboard["actions"][number];
export type HomeActionGroupKey = "overdue" | "today" | "interviews" | "undated" | "review";
export interface HomeActionGroup {
  key: HomeActionGroupKey;
  label: string;
  actions: HomeAction[];
  preview: HomeAction[];
  hiddenCount: number;
  recorded: boolean;
}
export type HomeDecisionState =
  | "loading"
  | "failure"
  | "partial"
  | "actions"
  | "waiting"
  | "no-known-action"
  | "no-records";

export interface HomeDecisionModel {
  state: HomeDecisionState;
  title: string;
  explanation: string;
  groups: HomeActionGroup[];
  focalGroup: HomeActionGroupKey | null;
  coverage: string;
  waitingPreview: OpportunityWorkspace["groups"]["waiting"]["items"];
  waitingCount: number;
}

const groupOrder: Array<{ key: HomeActionGroupKey; label: string; recorded: boolean }> = [
  { key: "overdue", label: "Recorded overdue follow-ups", recorded: true },
  { key: "today", label: "Follow-ups due today", recorded: true },
  { key: "interviews", label: "Scheduled interviews", recorded: true },
  { key: "undated", label: "Undated candidate steps", recorded: false },
  { key: "review", label: "Stage-age review suggestions", recorded: false },
];

function groupKey(action: HomeAction): HomeActionGroupKey {
  switch (action.kind) {
    case "FOLLOW_UP_OVERDUE": return "overdue";
    case "FOLLOW_UP_TODAY": return "today";
    case "INTERVIEW_SOON":
    case "INTERVIEW_UPCOMING": return "interviews";
    case "CANDIDATE_ACTION_UNDATED": return "undated";
    case "STALE_APPLICATION": return "review";
  }
}

function groupActions(actions: HomeAction[]): HomeActionGroup[] {
  const recordedCount = actions.filter((action) => groupOrder.find((group) => group.key === groupKey(action))?.recorded).length;
  return groupOrder.flatMap(({ key, label, recorded }) => {
    const matches = actions.filter((action) => groupKey(action) === key);
    if (!matches.length) return [];
    // A small set of peer commitments stays visible; large returned sets stay retrievable.
    const preview = recorded && recordedCount <= 3 ? matches : matches.slice(0, 1);
    return [{ key, label, actions: matches, preview, hiddenCount: matches.length - preview.length, recorded }];
  });
}

export function homeActionMeaning(action: HomeAction): {
  condition: string;
  owner: string;
  reason: string;
  limitation: string | null;
} {
  const followUpOwner = action.responsibility === "CANDIDATE"
    ? "Candidate-owned"
    : action.responsibility === "EMPLOYER"
      ? "Employer-owned; check-back saved"
      : "Owner not recorded";
  switch (action.kind) {
    case "FOLLOW_UP_OVERDUE":
      return { condition: "Recorded follow-up overdue", owner: followUpOwner, reason: action.label, limitation: "A recorded date signals timing, not personal importance." };
    case "FOLLOW_UP_TODAY":
      return { condition: "Recorded follow-up due today", owner: followUpOwner, reason: action.label, limitation: "A recorded date signals timing, not personal importance." };
    case "INTERVIEW_SOON":
      return { condition: "Interview coming up", owner: "Scheduled conversation", reason: action.label, limitation: null };
    case "INTERVIEW_UPCOMING":
      return { condition: "Scheduled interview", owner: "Scheduled conversation", reason: action.label, limitation: "This is on the calendar; it is not necessarily the most urgent move." };
    case "CANDIDATE_ACTION_UNDATED":
      return { condition: "Candidate step without a saved date", owner: "Candidate", reason: action.label, limitation: "No deadline is recorded for this step." };
    case "STALE_APPLICATION":
      return { condition: "Stage-age review suggestion", owner: "Suggested review", reason: action.label, limitation: "This is based on time in stage, not a missed deadline or a known employer update." };
  }
}

export function homeActionPreviewReason(action: HomeAction): string {
  switch (action.kind) {
    case "FOLLOW_UP_OVERDUE":
    case "FOLLOW_UP_TODAY":
      return action.label;
    case "INTERVIEW_SOON": return "Scheduled conversation within 24 hours.";
    case "INTERVIEW_UPCOMING": return "Scheduled conversation on the calendar.";
    case "CANDIDATE_ACTION_UNDATED": return action.label;
    case "STALE_APPLICATION": return "A review suggestion based on time in stage, not a missed deadline.";
  }
}

/** Dashboard actions are server-owned facts/cues; this model only limits their presentation. */
export function buildHomeDecisionModel({
  dashboard,
  dashboardPending,
  dashboardError,
  workspace,
  workspacePending,
  workspaceError,
}: {
  dashboard?: Dashboard;
  dashboardPending: boolean;
  dashboardError: boolean;
  workspace?: OpportunityWorkspace;
  workspacePending: boolean;
  workspaceError: boolean;
}): HomeDecisionModel {
  const coverage = "Home can show up to 100 due follow-ups and five upcoming interviews. Review Applications and Interviews for full records; their groupings may differ.";
  const groups = groupActions(dashboard?.actions ?? []);
  const recordedActions = groups.filter((group) => group.recorded).flatMap((group) => group.actions);
  const onlyRecorded = recordedActions.length === 1 ? recordedActions[0] : null;
  const focalGroup = !dashboardError && onlyRecorded && ["FOLLOW_UP_OVERDUE", "FOLLOW_UP_TODAY", "INTERVIEW_SOON"].includes(onlyRecorded.kind)
    ? groupKey(onlyRecorded)
    : null;
  const base = {
    groups,
    focalGroup,
    coverage,
    waitingPreview: workspace?.groups.waiting.items ?? [],
    waitingCount: workspace?.groups.waiting.total_count ?? 0,
  };
  if (dashboardPending && !dashboard) return { ...base, state: "loading", title: "Checking recorded work", explanation: "The decision context is loading; no conclusion is available yet." };
  if (dashboardError && !dashboard) return { ...base, state: "failure", title: "Recorded work is unavailable", explanation: "Home cannot determine what needs attention until its operational data loads." };
  if (!dashboard) return { ...base, state: "loading", title: "Checking recorded work", explanation: "The decision context is loading." };
  if (dashboardError) return {
    ...base,
    state: "partial",
    title: "The latest recorded-work check failed",
    explanation: "A previous snapshot is visible, but Home cannot confirm that it is still complete. Retry before treating it as an all-clear.",
  };
  if (dashboard.actions.length > 0) {
    const recorded = dashboard.actions.filter((action) => action.kind.startsWith("FOLLOW_UP") || action.kind.startsWith("INTERVIEW_")).length;
    return {
      ...base,
      state: "actions",
      title: recorded > 1 ? "Several recorded commitments" : recorded === 1 ? "A recorded commitment deserves a look" : "No recorded deadline is due; optional work is available",
      explanation: recorded ? "Dates show recorded timing, not personal importance." : "Suggested work has no recorded deadline.",
    };
  }
  if (dashboard.summary.total_tracked === 0) return { ...base, state: "no-records", title: "Start with a recorded opportunity", explanation: "There are no opportunities in this workspace yet, so Home cannot infer a next move." };
  if (workspacePending || workspaceError || !workspace) return {
    ...base,
    state: "partial",
    title: "The full decision context is not available",
    explanation: "No action surfaced in the Home summary, but opportunity ownership could not be checked. This is not an all-clear.",
  };
  if (workspace.groups.needs_action.total_count > 0) return {
    ...base,
    state: "partial",
    title: "Other recorded work may need you",
    explanation: "The Applications workspace identifies candidate work outside this Home summary. Review those opportunities before treating the search as clear.",
  };
  if (workspace.groups.waiting.total_count > 0) return {
    ...base,
    state: "waiting",
    title: "Some opportunities are in a waiting state",
    explanation: "The Applications workspace groups some recorded opportunities as waiting. Check each record's ownership; a saved candidate check-back appears separately when due.",
  };
  return {
    ...base,
    state: "no-known-action",
    title: "No candidate action surfaced in recorded work",
    explanation: "Nothing time-sensitive surfaced in this Home summary or the Applications workspace. This does not account for unrecorded obligations or preferences.",
  };
}
