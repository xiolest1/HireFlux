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
  "context",
  "progress",
  "prepare",
  "resolve",
  "act",
] as const satisfies readonly LandingStoryStage[];

export type LandingAdvancedHeroStage =
  (typeof landingHeroAutoplayStageOrder)[number];

export const landingStory = {
  opportunity: {
    company: "Northstar Labs",
    role: "Senior Frontend Platform Engineer",
    source: "Referral",
    workMode: "Remote",
    compensation: "$145k–$165k",
    location: "New York, NY",
    followUp: "Follow up September 5",
    decisionContext: "Review the platform scope before the technical screen",
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
    resolvedStatus: "Preparation saved",
    resolvedDetail: "Company context, examples, and questions retained",
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

export interface LandingScrollChapter {
  stage: LandingHeroStage;
  internalStage: LandingAdvancedHeroStage;
  number: string;
  label: string;
  question: string;
  title: string;
  description: string;
}

export const landingScrollChapters: readonly LandingScrollChapter[] = [
  {
    stage: "capture",
    internalStage: "capture",
    number: "01",
    label: "Capture",
    question: "What should HireFlux remember first?",
    title: "Start with decision-ready context.",
    description: "Role, source, work mode, compensation, and follow-up become one reliable record.",
  },
  {
    stage: "progress",
    internalStage: "progress",
    number: "02",
    label: "Progress",
    question: "How does the history stay connected?",
    title: "History stays attached.",
    description: "The technical screen joins that record, preserving what led there.",
  },
  {
    stage: "prepare",
    internalStage: "prepare",
    number: "03",
    label: "Prepare",
    question: "How does context guide interview preparation?",
    title: "Preparation starts informed.",
    description: "Company and interview context shape questions and a focused readiness checklist.",
  },
  {
    stage: "act",
    internalStage: "act",
    number: "04",
    label: "Act",
    question: "Why does this action come next?",
    title: "The journey explains what comes next.",
    description: "Saved preparation grounds a timely follow-up in what happened.",
  },
] as const;

export const landingHeroMilestoneByStage = Object.fromEntries(
  landingHeroMilestones.map((milestone) => [milestone.stage, milestone]),
) as Record<LandingHeroStage, LandingHeroMilestone>;
