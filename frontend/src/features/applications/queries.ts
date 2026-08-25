import {
  useInfiniteQuery,
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  createApplication,
  completeFollowUp,
  getApplication,
  getMe,
  listApplicationActivity,
  listApplications,
  rescheduleFollowUp,
  transitionApplication,
  updateApplication,
  type CreateApplicationRequest,
  type ApplicationListFilters,
  type TransitionApplicationRequest,
  type UpdateApplicationRequest,
} from "../../api/applications";
import type { ApplicationStatus } from "../../api/schemas";

export const applicationKeys = {
  all: ["applications"] as const,
  lists: () => [...applicationKeys.all, "list"] as const,
  list: (status: ApplicationStatus | null, limit = 20, filters: ApplicationListFilters = {}) =>
    [...applicationKeys.lists(), { status, limit, ...filters }] as const,
  details: () => [...applicationKeys.all, "detail"] as const,
  detail: (applicationId: string) =>
    [...applicationKeys.details(), applicationId] as const,
  activity: (applicationId: string, order: "asc" | "desc" = "asc", limit = 25) =>
    [...applicationKeys.detail(applicationId), "activity", { order, limit }] as const,
};

function invalidateWorkspaceInsights(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  void queryClient.invalidateQueries({ queryKey: ["analytics"] });
  void queryClient.invalidateQueries({ queryKey: ["pipeline"] });
}

function updateOpportunityCaches(queryClient: QueryClient, applicationId: string) {
  void queryClient.invalidateQueries({ queryKey: applicationKeys.lists() });
  void queryClient.invalidateQueries({
    queryKey: [...applicationKeys.detail(applicationId), "activity"],
  });
  void queryClient.invalidateQueries({ queryKey: ["interviews"] });
  invalidateWorkspaceInsights(queryClient);
}

export function useMe({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["me"],
    queryFn: ({ signal }) => getMe(signal),
    enabled,
  });
}

export function useApplications(
  status: ApplicationStatus | null = null,
  limit = 20,
  filters: ApplicationListFilters = {},
) {
  return useInfiniteQuery({
    queryKey: applicationKeys.list(status, limit, filters),
    queryFn: ({ pageParam, signal }) =>
      listApplications(pageParam, signal, limit, status ?? undefined, filters),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    placeholderData: keepPreviousData,
  });
}

export function useApplication(applicationId: string) {
  return useQuery({
    queryKey: applicationKeys.detail(applicationId),
    queryFn: ({ signal }) => getApplication(applicationId, signal),
    enabled: Boolean(applicationId),
  });
}

export function useApplicationActivity(
  applicationId: string,
  { order = "asc", limit = 25 }: { order?: "asc" | "desc"; limit?: number } = {},
) {
  return useInfiniteQuery({
    queryKey: applicationKeys.activity(applicationId, order, limit),
    queryFn: ({ signal, pageParam }) =>
      listApplicationActivity(applicationId, pageParam, signal, limit, order),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: Boolean(applicationId),
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateApplicationRequest) =>
      createApplication(request),
    onSuccess: (application) => {
      queryClient.setQueryData(
        applicationKeys.detail(application.application_id),
        application,
      );
      void queryClient.invalidateQueries({ queryKey: applicationKeys.lists() });
      invalidateWorkspaceInsights(queryClient);
    },
  });
}

interface UpdateMutationVariables {
  applicationId: string;
  request: UpdateApplicationRequest;
}

export function useUpdateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, request }: UpdateMutationVariables) =>
      updateApplication(applicationId, request),
    onSuccess: (application) => {
      queryClient.setQueryData(
        applicationKeys.detail(application.application_id),
        application,
      );
      void queryClient.invalidateQueries({ queryKey: applicationKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: [...applicationKeys.detail(application.application_id), "activity"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["applications", application.application_id, "interviews"],
      });
      void queryClient.invalidateQueries({ queryKey: ["interviews"] });
      invalidateWorkspaceInsights(queryClient);
    },
  });
}

interface TransitionMutationVariables {
  applicationId: string;
  request: TransitionApplicationRequest;
}

export function useTransitionApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, request }: TransitionMutationVariables) =>
      transitionApplication(applicationId, request),
    onSuccess: (application) => {
      queryClient.setQueryData(
        applicationKeys.detail(application.application_id),
        application,
      );
      void queryClient.invalidateQueries({ queryKey: applicationKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: [...applicationKeys.detail(application.application_id), "activity"],
      });
      void queryClient.invalidateQueries({ queryKey: ["interviews"] });
      invalidateWorkspaceInsights(queryClient);
    },
  });
}

export function useCompleteApplicationFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, expectedVersion }: {
      applicationId: string;
      expectedVersion: number;
    }) => completeFollowUp(applicationId, expectedVersion),
    onSuccess: (application) => {
      queryClient.setQueryData(applicationKeys.detail(application.application_id), application);
      updateOpportunityCaches(queryClient, application.application_id);
    },
  });
}

export function useRescheduleApplicationFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, expectedVersion, followUpDate }: {
      applicationId: string;
      expectedVersion: number;
      followUpDate: string;
    }) => rescheduleFollowUp(applicationId, expectedVersion, followUpDate),
    onSuccess: (application) => {
      queryClient.setQueryData(applicationKeys.detail(application.application_id), application);
      updateOpportunityCaches(queryClient, application.application_id);
    },
  });
}
