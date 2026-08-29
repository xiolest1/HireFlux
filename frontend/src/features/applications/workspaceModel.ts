import type { Application, ApplicationStatus, Interview } from "../../api/schemas";

export type WorkspaceActionKind =
  | "transition"
  | "follow-up"
  | "interview"
  | "prepare"
  | "note";

export interface WorkspaceAction {
  kind: WorkspaceActionKind;
  label: string;
  transition?: ApplicationStatus;
  interviewId?: string;
}

export interface ApplicationWorkspaceModel {
  eyebrow: string;
  guidance: string;
  primary: WorkspaceAction | null;
  secondary: WorkspaceAction | null;
  moreTransitions: ApplicationStatus[];
  interviewEmptyMessage: string;
}

interface WorkspaceModelInput {
  application: Application;
  interviews: Interview[];
  today: string;
  now?: Date;
}

const transitionLabels: Partial<Record<ApplicationStatus, string>> = {
  DRAFT: "Correct to Draft",
  APPLIED: "Mark as applied",
  SCREENING: "Move to Screening",
  INTERVIEW: "Move to Interview",
  OFFER: "Move to Offer",
  ACCEPTED: "Accept offer",
  REJECTED: "Mark as rejected",
  WITHDRAWN: "Withdraw application",
  ARCHIVED: "Archive opportunity",
};

function transitionAction(
  application: Application,
  status: ApplicationStatus,
  label = transitionLabels[status] ?? `Move to ${status.toLowerCase()}`,
): WorkspaceAction | null {
  return application.allowed_transitions.includes(status)
    ? { kind: "transition", label, transition: status }
    : null;
}

export function selectApplicationWorkspace({
  application,
  interviews,
  today,
  now = new Date(),
}: WorkspaceModelInput): ApplicationWorkspaceModel {
  const scheduled = interviews
    .filter((interview) => interview.status === "SCHEDULED")
    .sort((left, right) => left.scheduled_at.localeCompare(right.scheduled_at));
  const nextInterview = scheduled.find(
    (interview) => new Date(interview.scheduled_at).getTime() >= now.getTime(),
  );
  const missedInterview = scheduled.find(
    (interview) => new Date(interview.scheduled_at).getTime() < now.getTime(),
  );
  const followUpDue =
    application.follow_up_date !== null && application.follow_up_date <= today;
  const candidateAction = application.next_step_responsibility === "CANDIDATE";
  const unresolvedNextStep = application.next_step_responsibility === null;
  let primary: WorkspaceAction | null = null;
  let secondary: WorkspaceAction | null = null;
  let eyebrow = "Keep this opportunity moving";
  let guidance = "Review the latest context and choose the next useful step.";
  let interviewEmptyMessage = "No interview rounds are scheduled yet.";

  switch (application.status) {
    case "DRAFT":
      eyebrow = "Complete this draft";
      guidance = "Finish the essentials, then mark the opportunity as applied.";
      primary = transitionAction(application, "APPLIED");
      secondary = { kind: "note", label: "Add note" };
      interviewEmptyMessage = "Interview planning becomes relevant after you apply.";
      break;
    case "APPLIED":
      if (nextInterview) {
        primary = {
          kind: "prepare",
          label: "Prepare interview",
          interviewId: nextInterview.interview_id,
        };
      } else if (candidateAction || followUpDue || unresolvedNextStep) {
        primary = { kind: "follow-up", label: "Review next step" };
      } else {
        primary = transitionAction(application, "SCREENING") ?? {
          kind: "follow-up",
          label: "Manage next step",
        };
      }
      secondary = primary?.kind === "transition"
        ? { kind: "follow-up", label: "Manage next step" }
        : transitionAction(application, "SCREENING");
      break;
    case "SCREENING":
      primary = nextInterview
        ? {
            kind: "prepare",
            label: "Prepare interview",
            interviewId: nextInterview.interview_id,
          }
        : { kind: "interview", label: "Schedule interview" };
      secondary = transitionAction(application, "INTERVIEW");
      break;
    case "INTERVIEW":
      primary = missedInterview
        ? { kind: "interview", label: "Resolve missed round" }
        : nextInterview
          ? {
              kind: "prepare",
              label: "Prepare next round",
              interviewId: nextInterview.interview_id,
            }
          : { kind: "interview", label: "Schedule another interview" };
      secondary = transitionAction(application, "OFFER");
      break;
    case "OFFER":
      eyebrow = "Decide what comes next";
      guidance = "Record the outcome when you are ready.";
      primary = { kind: "transition", label: "Update decision" };
      secondary = { kind: "note", label: "Add offer note" };
      break;
    case "ACCEPTED":
      eyebrow = "Outcome complete";
      guidance = "Capture any final context, then archive when it is no longer active.";
      primary = { kind: "note", label: "Add final note" };
      break;
    case "REJECTED":
      eyebrow = "Reflect and retain what you learned";
      guidance = "A short reflection can make the next application stronger.";
      primary = { kind: "note", label: "Add reflection" };
      secondary = transitionAction(application, "ARCHIVED");
      interviewEmptyMessage = "No interview action is needed for this closed opportunity.";
      break;
    case "WITHDRAWN":
      eyebrow = "Candidate decision recorded";
      guidance = "Add a reflection or archive this opportunity when you are finished.";
      primary = { kind: "note", label: "Add reflection" };
      secondary = transitionAction(application, "ARCHIVED");
      interviewEmptyMessage = "No interview action is needed for this closed opportunity.";
      break;
    case "ARCHIVED": {
      eyebrow = "Historical opportunity";
      guidance = "This record is read-oriented. Restore it only if the pursuit becomes active again.";
      const restore = application.allowed_transitions[0];
      primary = restore
        ? transitionAction(application, restore, `Restore to ${restore.toLowerCase()}`)
        : null;
      interviewEmptyMessage = "Interview history will appear here when available.";
      break;
    }
  }

  const promoted = new Set(
    [primary?.transition, secondary?.transition].filter(Boolean),
  );
  return {
    eyebrow,
    guidance,
    primary,
    secondary,
    moreTransitions: application.allowed_transitions.filter(
      (status) => !promoted.has(status),
    ),
    interviewEmptyMessage,
  };
}
