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
  getApplication,
  getMe,
  listApplicationActivity,
  listApplications,
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
  activity: (applicationId: string) =>
    [...applicationKeys.detail(applicationId), "activity"] as const,
};

function invalidateWorkspaceInsights(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  void queryClient.invalidateQueries({ queryKey: ["analytics"] });
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: ({ signal }) => getMe(signal),
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

export function useApplicationActivity(applicationId: string) {
  return useInfiniteQuery({
    queryKey: applicationKeys.activity(applicationId),
    queryFn: ({ signal, pageParam }) => listApplicationActivity(applicationId, pageParam, signal),
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
        queryKey: applicationKeys.activity(application.application_id),
      });
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
        queryKey: applicationKeys.activity(application.application_id),
      });
      invalidateWorkspaceInsights(queryClient);
    },
  });
}
