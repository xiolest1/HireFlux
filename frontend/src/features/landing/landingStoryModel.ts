export const landingStoryStageOrder = [
  "orientation",
  "capture",
  "context",
  "progress",
  "prepare",
  "resolve",
  "act",
] as const;

export type LandingStoryStage = (typeof landingStoryStageOrder)[number];

export const landingHeroStageOrder = [
  "capture",
  "progress",
  "prepare",
  "act",
] as const satisfies readonly LandingStoryStage[];

export type LandingHeroStage = (typeof landingHeroStageOrder)[number];

export const landingHeroAutoplayStageOrder = [
  "capture",
  "progress",
  "prepare",
] as const satisfies readonly LandingHeroStage[];

export type LandingAdvancedHeroStage =
  (typeof landingHeroAutoplayStageOrder)[number];

export const landingStory = {
  opportunity: {
    company: "Northstar Labs",
    role: "Senior Frontend Platform Engineer",
    source: "Referral",
    workMode: "Remote",
    compensation: "$145k–$165k",
  },
  interview: {
    dateLabel: "September 2 · 10:00 AM",
    title: "Technical screen scheduled",
  },
  preparation: {
    readyCount: 2,
    totalCount: 3,
    savedContext: "Company context and examples saved",
    remainingAction: "Write two questions to ask",
  },
  action: {
    status: "Due today",
    context: "Interview completed · Follow-up pending",
    nextAction: "Send a thoughtful follow-up",
    proofAction: "Send a concise follow-up while the interview is fresh.",
  },
} as const;

export interface LandingHeroMilestone {
  stage: LandingHeroStage;
  label: string;
  eyebrow: string;
  status: string;
  title: string;
  detail: string;
  nextLabel: string;
  nextAction: string;
}

export const landingHeroMilestones: readonly LandingHeroMilestone[] = [
  {
    stage: "capture",
    label: "Capture",
    eyebrow: "Opportunity captured",
    status: "Draft",
    title: "Role details are together",
    detail: `${landingStory.opportunity.source} · ${landingStory.opportunity.workMode} · ${landingStory.opportunity.compensation}`,
    nextLabel: "Next",
    nextAction: "Review role details",
  },
  {
    stage: "progress",
    label: "Progress",
    eyebrow: "Application progressing",
    status: "Interview",
    title: landingStory.interview.title,
    detail: landingStory.interview.dateLabel,
    nextLabel: "Next",
    nextAction: "Prepare for the interview",
  },
  {
    stage: "prepare",
    label: "Prepare",
    eyebrow: "Interview preparation",
    status: `${landingStory.preparation.readyCount} of ${landingStory.preparation.totalCount} ready`,
    title: "Your prep has a clear finish line",
    detail: landingStory.preparation.savedContext,
    nextLabel: "Remaining",
    nextAction: landingStory.preparation.remainingAction,
  },
  {
    stage: "act",
    label: "Act",
    eyebrow: "Action center",
    status: landingStory.action.status,
    title: "The next move is visible",
    detail: landingStory.action.context,
    nextLabel: "Do now",
    nextAction: landingStory.action.nextAction,
  },
] as const;

export interface LandingProofStep {
  stage: Extract<LandingHeroStage, "capture" | "progress" | "act">;
  number: string;
  label: string;
  title: string;
  description: string;
  result: string;
  question: string;
  answer: string;
}

export const landingProofSteps: readonly LandingProofStep[] = [
  {
    stage: "capture",
    number: "01",
    label: "Capture",
    title: "Turn a job post into an opportunity",
    description: "Keep the role, source, work mode, compensation context, and follow-up date in one reliable record.",
    result: `Captured from a ${landingStory.opportunity.source.toLowerCase()}`,
    question: "What needs a decision?",
    answer: "Review the role and submit by Friday.",
  },
  {
    stage: "progress",
    number: "02",
    label: "Move",
    title: "Carry context into every conversation",
    description: "Advance through valid stages, schedule the technical screen, and keep preparation attached to the same opportunity.",
    result: `Interview · ${landingStory.interview.dateLabel.split(" · ")[0]}`,
    question: "What should I prepare?",
    answer: `Finish one checklist item and ${landingStory.preparation.totalCount - 1} candidate questions.`,
  },
  {
    stage: "act",
    number: "03",
    label: "Learn",
    title: "Use history to choose the next move",
    description: "See the milestones that already happened and let the action center surface what deserves attention now.",
    result: "Follow-up due today",
    question: "What should I do next?",
    answer: landingStory.action.proofAction,
  },
] as const;

export const landingHeroMilestoneByStage = Object.fromEntries(
  landingHeroMilestones.map((milestone) => [milestone.stage, milestone]),
) as Record<LandingHeroStage, LandingHeroMilestone>;
