export type BenefitVisual =
  | {
      kind: "perspective";
      stages: readonly {
        label: string;
        value: number;
      }[];
    }
  | {
      kind: "attention";
      priorities: readonly {
        level: "now" | "waiting" | "later";
        label: string;
        detail: string;
      }[];
    }
  | {
      kind: "preparation";
      context: readonly string[];
      checklist: readonly {
        label: string;
        complete: boolean;
      }[];
    }
  | {
      kind: "search-health";
      responseRate: string;
      signals: readonly {
        label: string;
        value: string;
      }[];
      movement: readonly number[];
    };

export interface ProductBenefit {
  id: "search-visibility" | "attention" | "preparation" | "search-health";
  category: string;
  headline: string;
  body: string;
  visual: BenefitVisual;
}

export const productBenefits: readonly ProductBenefit[] = [
  {
    id: "search-visibility",
    category: "Perspective",
    headline: "Keep the whole search in view.",
    body: "See every opportunity in context so one interview or deadline never hides what else is moving.",
    visual: {
      kind: "perspective",
      stages: [
        { label: "Applied", value: 8 },
        { label: "Interviewing", value: 3 },
        { label: "Follow-up", value: 2 },
        { label: "Offer", value: 1 },
      ],
    },
  },
  {
    id: "attention",
    category: "Attention",
    headline: "Know what deserves attention.",
    body: "Separate what needs action now from what is waiting or can be reviewed later.",
    visual: {
      kind: "attention",
      priorities: [
        { level: "now", label: "Do now", detail: "Follow up after technical screen" },
        { level: "waiting", label: "Waiting", detail: "Recruiter response" },
        { level: "later", label: "Review later", detail: "Older application" },
      ],
    },
  },
  {
    id: "preparation",
    category: "Preparation",
    headline: "Prepare without rebuilding everything.",
    body: "Carry role and interview context forward so preparation starts from what you already know.",
    visual: {
      kind: "preparation",
      context: ["Role", "Interview", "Notes"],
      checklist: [
        { label: "Evidence story", complete: true },
        { label: "Role review", complete: true },
        { label: "Candidate questions", complete: false },
      ],
    },
  },
  {
    id: "search-health",
    category: "Search health",
    headline: "Understand whether the search is working.",
    body: "See response patterns, stalled applications, and follow-up gaps instead of judging the search by application count alone.",
    visual: {
      kind: "search-health",
      responseRate: "24%",
      signals: [
        { label: "Stalled 15+ days", value: "4" },
        { label: "Follow-ups due", value: "2" },
      ],
      movement: [38, 62, 48, 76, 68, 88],
    },
  },
];
