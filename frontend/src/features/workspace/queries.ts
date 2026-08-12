import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useDashboard(range: DashboardRange) {
  return useQuery({
    queryKey: workspaceKeys.dashboard(range),
    queryFn: ({ signal }) => getDashboard(range, signal),
  });
}

export function useAnalytics(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: workspaceKeys.analytics(filters),
    queryFn: ({ signal }) => getAnalytics(filters, signal),
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
