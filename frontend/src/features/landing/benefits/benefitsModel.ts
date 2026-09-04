export type BenefitSignalTone = "neutral" | "accent" | "violet" | "success" | "warning";

export type BenefitSignalWidth = "small" | "medium" | "wide";

export type BenefitSignalStateTreatment = "label" | "badge";

export interface BenefitSignalContent {
  id:
    | "search-perspective"
    | "immediate-attention"
    | "context-continuity"
    | "intentional-waiting"
    | "informed-preparation"
    | "follow-up-coverage"
    | "search-movement";
  state: string;
  headline: string;
  support: string;
  tone: BenefitSignalTone;
  width: BenefitSignalWidth;
  stateTreatment: BenefitSignalStateTreatment;
}

export const benefitSignals: readonly BenefitSignalContent[] = [
  {
    id: "search-perspective",
    state: "3 active interviews",
    headline: "Keep the whole search in perspective.",
    support: "See every opportunity without letting one role take over.",
    tone: "accent",
    width: "wide",
    stateTreatment: "label",
  },
  {
    id: "immediate-attention",
    state: "Due today",
    headline: "Know what needs you now.",
    support: "Separate the next action from everything else.",
    tone: "warning",
    width: "medium",
    stateTreatment: "badge",
  },
  {
    id: "context-continuity",
    state: "Context retained",
    headline: "Stop hunting for context.",
    support: "Role, interview, and notes stay connected.",
    tone: "violet",
    width: "medium",
    stateTreatment: "label",
  },
  {
    id: "intentional-waiting",
    state: "Waiting",
    headline: "Know when not to act.",
    support: "See when the employer owns the next move.",
    tone: "neutral",
    width: "small",
    stateTreatment: "badge",
  },
  {
    id: "informed-preparation",
    state: "2 of 3 ready",
    headline: "Prepare from what you already know.",
    support: "Start informed instead of rebuilding the story.",
    tone: "success",
    width: "wide",
    stateTreatment: "badge",
  },
  {
    id: "follow-up-coverage",
    state: "Follow-up gap",
    headline: "Catch what still needs a response.",
    support: "Notice silence before an opportunity slips away.",
    tone: "warning",
    width: "medium",
    stateTreatment: "label",
  },
  {
    id: "search-movement",
    state: "Recent movement",
    headline: "See what changed across your search.",
    support: "Spot progress without opening every record.",
    tone: "accent",
    width: "wide",
    stateTreatment: "label",
  },
];
