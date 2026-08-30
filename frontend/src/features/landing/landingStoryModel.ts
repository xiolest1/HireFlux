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

export const landingWorkspaceStageOrder = [
  "applications",
  "interviews",
  "preparation",
  "action-center",
] as const;

export type LandingWorkspaceStage = (typeof landingWorkspaceStageOrder)[number];

export interface LandingScrollChapter {
  stage: LandingWorkspaceStage;
  number: string;
  label: string;
  question: string;
  title: string;
  description: string;
}

export const landingScrollChapters: readonly LandingScrollChapter[] = [
  {
    stage: "applications",
    number: "01",
    label: "Applications",
    question: "How do I keep the search organized?",
    title: "Everything starts in one workspace.",
    description: "Three opportunities, their current stages, and the next decision stay visible without turning one role into the whole search.",
  },
  {
    stage: "interviews",
    number: "02",
    label: "Interviews",
    question: "How does the history stay connected?",
    title: "Context follows the opportunity.",
    description: "Northstar becomes supporting context while its technical screen, timing, and preparation status take focus.",
  },
  {
    stage: "preparation",
    number: "03",
    label: "Preparation",
    question: "How does that context improve preparation?",
    title: "Preparation starts informed.",
    description: "Company context, interview details, questions, and evidence become one focused working surface.",
  },
  {
    stage: "action-center",
    number: "04",
    label: "Action Center",
    question: "What deserves attention next?",
    title: "The workspace turns history into priorities.",
    description: "Do-now, waiting, and review-later signals bring the whole search back into view with clear provenance.",
  },
] as const;

export const landingWorkspace = {
  opportunities: [
    {
      company: landingStory.opportunity.company,
      role: landingStory.opportunity.role,
      status: "Interview",
      next: "Technical screen · Sep 2",
      tone: "violet",
    },
    {
      company: "Atlas Systems",
      role: "Product Platform Engineer",
      status: "Applied",
      next: "Waiting for employer",
      tone: "muted",
    },
    {
      company: "Harborline",
      role: "Frontend Infrastructure Engineer",
      status: "Screening",
      next: "Review role notes",
      tone: "accent",
    },
  ],
  priorities: [
    {
      company: landingStory.opportunity.company,
      action: landingStory.action.nextAction,
      timing: "Due today",
      provenance: "Interview complete · Preparation retained",
      priority: "now",
    },
    {
      company: "Atlas Systems",
      action: "Wait for employer response",
      timing: "Waiting",
      provenance: "Application sent August 28",
      priority: "waiting",
    },
    {
      company: "Harborline",
      action: "Review role notes",
      timing: "Review later",
      provenance: "Screening details saved",
      priority: "later",
    },
  ],
} as const;

export const landingHeroMilestoneByStage = Object.fromEntries(
  landingHeroMilestones.map((milestone) => [milestone.stage, milestone]),
) as Record<LandingHeroStage, LandingHeroMilestone>;
