import {
  CalendarClock,
  CircleAlert,
  Clock3,
  Gift,
  Hourglass,
  ListChecks,
  MoveRight,
} from "lucide-react";
import type {
  Application,
  OpportunityAction,
  OpportunityReason,
  OpportunityWorkspaceItem,
} from "../../api/schemas";
import { formatDateOnly, formatTimestamp } from "./format";

export interface OpportunityReasonPresentation {
  label: string;
  description: string;
  tone: "urgent" | "attention" | "progress" | "waiting";
  icon: typeof CircleAlert;
}

export const opportunityReasonPresentation: Record<
  OpportunityReason,
  OpportunityReasonPresentation
> = {
  MISSED_INTERVIEW: {
    label: "Interview time has passed",
    description: "Resolve the round so your interview journey stays accurate.",
    tone: "urgent",
    icon: CircleAlert,
  },
  FOLLOW_UP_OVERDUE: {
    label: "Follow-up is overdue",
    description: "Review the planned check-back and choose the next step.",
    tone: "urgent",
    icon: Clock3,
  },
  FOLLOW_UP_DUE_TODAY: {
    label: "Follow-up is due today",
    description: "This is the check-back date you planned.",
    tone: "attention",
    icon: CalendarClock,
  },
  INTERVIEW_PREPARATION_DUE: {
    label: "Interview preparation is due",
    description: "Complete the essential preparation before this upcoming round.",
    tone: "urgent",
    icon: ListChecks,
  },
  OFFER_DECISION: {
    label: "Offer needs a decision",
    description: "Review the opportunity and record your decision when ready.",
    tone: "attention",
    icon: Gift,
  },
  CANDIDATE_ACTION_UPCOMING: {
    label: "Your next action is coming up",
    description: "Review the action you planned for this opportunity.",
    tone: "attention",
    icon: CalendarClock,
  },
  INTERVIEW_PREPARATION_UPCOMING: {
    label: "Interview preparation is available",
    description: "Build your preparation ahead of the scheduled round.",
    tone: "attention",
    icon: ListChecks,
  },
  CANDIDATE_ACTION_UNSCHEDULED: {
    label: "Your next action needs a date",
    description: "Open the opportunity to plan when you will act.",
    tone: "attention",
    icon: ListChecks,
  },
  INTERVIEW_SCHEDULED: {
    label: "Interview scheduled",
    description: "Preparation essentials are complete and the process is moving.",
    tone: "progress",
    icon: MoveRight,
  },
  PROCESS_PROGRESSING: {
    label: "Process is moving forward",
    description: "No immediate candidate action is due.",
    tone: "progress",
    icon: MoveRight,
  },
  CANDIDATE_ACTION_PLANNED: {
    label: "Next action is planned",
    description: "Your candidate-owned action is scheduled for later.",
    tone: "progress",
    icon: CalendarClock,
  },
  WAITING_FOR_EMPLOYER: {
    label: "Waiting for the employer",
    description: "The next move belongs to the employer; keep your check-back in view.",
    tone: "waiting",
    icon: Hourglass,
  },
  RECENTLY_APPLIED: {
    label: "Application is with the employer",
    description: "There is no candidate-owned action due right now.",
    tone: "waiting",
    icon: Hourglass,
  },
};

const opportunityActionLabel: Record<OpportunityAction, string> = {
  RESOLVE_INTERVIEW: "Resolve interview",
  REVIEW_FOLLOW_UP: "Review follow-up",
  PREPARE_INTERVIEW: "Prepare interview",
  REVIEW_OFFER: "Review offer",
  OPEN_OPPORTUNITY: "Open opportunity",
};

export function opportunityActionText(
  item: OpportunityWorkspaceItem,
): string {
  if (item.classification.reason_code === "CANDIDATE_ACTION_UPCOMING") {
    return "Review next action";
  }
  if (item.classification.reason_code === "CANDIDATE_ACTION_UNSCHEDULED") {
    return "Plan next action";
  }
  return opportunityActionLabel[item.classification.action_type];
}

export function opportunitySupportingText(
  item: OpportunityWorkspaceItem,
  timeZone: string,
): string | null {
  const { classification } = item;
  const date = classification.relevant_date
    ? formatDateOnly(classification.relevant_date)
    : null;
  const instant = classification.relevant_at
    ? formatTimestamp(classification.relevant_at, timeZone)
    : null;

  switch (classification.reason_code) {
    case "MISSED_INTERVIEW":
      return instant ? `Scheduled ${instant}` : null;
    case "FOLLOW_UP_OVERDUE":
      return date ? `Planned check-back ${date}` : null;
    case "FOLLOW_UP_DUE_TODAY":
      return "Check back today";
    case "INTERVIEW_PREPARATION_DUE":
    case "INTERVIEW_PREPARATION_UPCOMING":
      return instant ? `Interview ${instant}` : null;
    case "CANDIDATE_ACTION_UPCOMING":
      return date ? `Planned for ${date}` : null;
    case "INTERVIEW_SCHEDULED":
      return instant ? `Interview · ${instant}` : null;
    case "CANDIDATE_ACTION_PLANNED":
      return date ? `Your next action · ${date}` : null;
    case "PROCESS_PROGRESSING":
      return "No action needed right now";
    case "WAITING_FOR_EMPLOYER":
      return date ? `Check back · ${date}` : "Waiting on employer";
    case "RECENTLY_APPLIED":
      return date ? `Applied · ${date}` : null;
    default:
      return date ?? instant;
  }
}

export function flatOpportunitySupportingText(application: Application): string {
  if (
    application.next_step_responsibility === "CANDIDATE" &&
    application.next_step_note
  ) {
    return application.next_step_note;
  }
  if (
    application.next_step_responsibility === "CANDIDATE" &&
    application.follow_up_date
  ) {
    return `Your next action · ${formatDateOnly(application.follow_up_date)}`;
  }
  if (
    application.next_step_responsibility === "EMPLOYER" &&
    application.follow_up_date
  ) {
    return `Check back · ${formatDateOnly(application.follow_up_date)}`;
  }
  if (application.next_step_responsibility === "EMPLOYER") {
    return "Waiting on employer";
  }
  if (application.follow_up_date) {
    return `Check back · ${formatDateOnly(application.follow_up_date)}`;
  }
  if (application.status === "DRAFT") return "Draft";
  return application.applied_date
    ? `Applied · ${formatDateOnly(application.applied_date)}`
    : "Application details available";
}
