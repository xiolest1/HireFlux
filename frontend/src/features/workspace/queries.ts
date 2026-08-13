import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  completeFollowUp,
  getApplication,
  rescheduleFollowUp,
} from "../../api/applications";
import {
  getAnalytics,
  getDashboard,
  type AnalyticsFilters,
} from "../../api/workspace";
import type { DashboardRange } from "../../api/schemas";
import { applicationKeys } from "../applications/queries";

export const workspaceKeys = {
  dashboard: (range: DashboardRange) => ["dashboard", range] as const,
  analytics: (filters: AnalyticsFilters) => ["analytics", filters] as const,
};

export const RECRUITER_GUIDE_EVENT = "hireflux:recruiter-guide";

export type RecruiterGuideStep = "status" | "engagement" | "analytics";

export interface RecruiterGuideState {
  status: boolean;
  engagement: boolean;
  analytics: boolean;
  dismissed: boolean;
}

const EMPTY_GUIDE: RecruiterGuideState = {
  status: false,
  engagement: false,
  analytics: false,
  dismissed: false,
};

const RECRUITER_GUIDE_STORAGE_KEY = "hireflux-recruiter-guide";

export function readRecruiterGuide(): RecruiterGuideState {
  if (typeof window === "undefined") return EMPTY_GUIDE;
  try {
    const value = window.sessionStorage.getItem(RECRUITER_GUIDE_STORAGE_KEY);
    if (!value) return EMPTY_GUIDE;
    const parsed = JSON.parse(value) as Partial<RecruiterGuideState>;
    return {
      status: parsed.status === true,
      engagement: parsed.engagement === true,
      analytics: parsed.analytics === true,
      dismissed: parsed.dismissed === true,
    };
  } catch {
    return EMPTY_GUIDE;
  }
}

export function updateRecruiterGuide(
  update: RecruiterGuideStep | "dismissed",
) {
  if (typeof window === "undefined") return EMPTY_GUIDE;
  const next = { ...readRecruiterGuide(), [update]: true };
  window.sessionStorage.setItem(RECRUITER_GUIDE_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent(RECRUITER_GUIDE_EVENT, { detail: { step: update } }),
  );
  return next;
}

export function useDashboard(range: DashboardRange) {
  return useQuery({
    queryKey: workspaceKeys.dashboard(range),
    queryFn: ({ signal }) => getDashboard(range, signal),
    placeholderData: keepPreviousData,
  });
}

export function useAnalytics(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: workspaceKeys.analytics(filters),
    queryFn: ({ signal }) => getAnalytics(filters, signal),
    placeholderData: keepPreviousData,
  });
}

function useFollowUpMutation(
  mutation: (applicationId: string, version: number) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (applicationId: string) => {
      const application = await getApplication(applicationId);
      return mutation(applicationId, application.version);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
      void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
    },
  });
}

export function useCompleteFollowUp() {
  return useFollowUpMutation((applicationId, version) =>
    completeFollowUp(applicationId, version),
  );
}

export function useRescheduleFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      applicationId,
      followUpDate,
    }: {
      applicationId: string;
      followUpDate: string;
    }) => {
      const application = await getApplication(applicationId);
      return rescheduleFollowUp(applicationId, application.version, followUpDate);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
      void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
    },
  });
}
