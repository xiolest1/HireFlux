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

export const SEARCH_TOUR_EVENT = "hireflux:search-tour";

export type SearchTourStep = "status" | "engagement" | "analytics";

export interface SearchTourState {
  status: boolean;
  engagement: boolean;
  analytics: boolean;
  dismissed: boolean;
}

const EMPTY_TOUR: SearchTourState = {
  status: false,
  engagement: false,
  analytics: false,
  dismissed: false,
};

export const SEARCH_TOUR_STORAGE_KEY = "hireflux-search-tour";
export const LEGACY_RECRUITER_GUIDE_STORAGE_KEY = "hireflux-recruiter-guide";

export function readSearchTour(): SearchTourState {
  if (typeof window === "undefined") return EMPTY_TOUR;
  try {
    const value =
      window.sessionStorage.getItem(SEARCH_TOUR_STORAGE_KEY) ??
      window.sessionStorage.getItem(LEGACY_RECRUITER_GUIDE_STORAGE_KEY);
    if (!value) return EMPTY_TOUR;
    const parsed = JSON.parse(value) as Partial<SearchTourState>;
    return {
      status: parsed.status === true,
      engagement: parsed.engagement === true,
      analytics: parsed.analytics === true,
      dismissed: parsed.dismissed === true,
    };
  } catch {
    return EMPTY_TOUR;
  }
}

export function updateSearchTour(update: SearchTourStep | "dismissed") {
  if (typeof window === "undefined") return EMPTY_TOUR;
  const next = { ...readSearchTour(), [update]: true };
  window.sessionStorage.setItem(SEARCH_TOUR_STORAGE_KEY, JSON.stringify(next));
  window.sessionStorage.removeItem(LEGACY_RECRUITER_GUIDE_STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent(SEARCH_TOUR_EVENT, { detail: { step: update } }),
  );
  return next;
}

export function clearSearchTour() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SEARCH_TOUR_STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_RECRUITER_GUIDE_STORAGE_KEY);
  } catch {
    // Reset and exit remain available when browser storage is unavailable.
  }
}

export function useDashboard(range: DashboardRange) {
  return useQuery({
    queryKey: workspaceKeys.dashboard(range),
    queryFn: ({ signal }) => getDashboard(range, signal),
    placeholderData: keepPreviousData,
  });
}

export function useAnalytics(
  filters: AnalyticsFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: workspaceKeys.analytics(filters),
    queryFn: ({ signal }) => getAnalytics(filters, signal),
    placeholderData: keepPreviousData,
    enabled,
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
      void queryClient.invalidateQueries({ queryKey: ["pipeline"] });
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
      void queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
    },
  });
}
