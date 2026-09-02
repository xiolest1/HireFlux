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
    question: "How do I keep every opportunity in view?",
    title: "Everything starts in one workspace.",
    description: "Keep the whole search visible without letting one role take over your attention.",
  },
  {
    stage: "interviews",
    number: "02",
    label: "Interviews",
    question: "What should carry into the interview?",
    title: "Context follows the opportunity.",
    description: "The details you already captured stay attached, so you can focus on the interview instead of rebuilding the story.",
  },
  {
    stage: "preparation",
    number: "03",
    label: "Preparation",
    question: "How does that context help me prepare?",
    title: "Preparation starts informed.",
    description: "Start from what you already know instead of rebuilding company, role, and interview context from scratch.",
  },
  {
    stage: "action-center",
    number: "04",
    label: "Action Center",
    question: "What deserves attention next?",
    title: "The workspace turns history into priorities.",
    description: "Completed work helps separate what needs action now from what can wait.",
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
