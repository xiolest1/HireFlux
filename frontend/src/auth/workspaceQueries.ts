import {
  useQuery, useInfiniteQuery, useMutation,
  type UseQueryOptions, type UseInfiniteQueryOptions, type InfiniteData, type QueryKey,
  type UseMutationOptions, type MutateOptions,
} from "@tanstack/react-query";
import { inSessionScope, type SessionScope } from "./sessionGeneration";
import { useWorkspaceSession } from "./workspaceSessionContext";

export function useWorkspaceQuery<T, E = Error, D = T, K extends QueryKey = QueryKey>(options: UseQueryOptions<T, E, D, K>) {
  const { state } = useWorkspaceSession();
  const scope = state.scope;
  const queryFn = options.queryFn;
  return useQuery({
    ...options,
    enabled: state.status === "ready" && options.enabled !== false,
    queryFn: typeof queryFn === "function" ? (context) => inSessionScope(scope, () => Promise.resolve(queryFn(context))) : queryFn,
  });
}

export function useWorkspaceInfiniteQuery<T, E = Error, D = InfiniteData<T>, K extends QueryKey = QueryKey, P = unknown>(options: UseInfiniteQueryOptions<T, E, D, K, P>) {
  const { state } = useWorkspaceSession();
  const scope = state.scope;
  const queryFn = options.queryFn;
  return useInfiniteQuery({
    ...options,
    enabled: state.status === "ready" && options.enabled !== false,
    queryFn: typeof queryFn === "function" ? (context) => inSessionScope(scope, () => Promise.resolve(queryFn(context))) : queryFn,
  });
}

/** Guards observer callbacks, per-call callbacks, and mutateAsync continuations. No replay. */
export function useWorkspaceMutation<T, E = Error, V = void, C = unknown>(options: UseMutationOptions<T, E, V, C>) {
  const { state } = useWorkspaceSession();
  const scope = state.scope;
  type ScopedVariables = { value: V; scope: SessionScope };
  const mutation = useMutation<T, E, ScopedVariables, C>({
    ...options,
    retry: false,
    mutationFn: ({ value, scope: origin }, context) => inSessionScope(origin, () => {
      if (!options.mutationFn) throw new Error("A workspace mutation requires a function.");
      return options.mutationFn(value, context);
    }),
    onMutate: options.onMutate ? ({ value, scope: origin }, context) => {
      origin.assertCurrent();
      return options.onMutate!(value, context);
    } : undefined,
    onSuccess: (data, variables, result, context) => {
      if (variables.scope.isCurrent()) return options.onSuccess?.(data, variables.value, result, context);
    },
    onError: (error, variables, result, context) => {
      if (variables.scope.isCurrent()) return options.onError?.(error, variables.value, result, context);
    },
    onSettled: (data, error, variables, result, context) => {
      if (variables.scope.isCurrent()) return options.onSettled?.(data, error, variables.value, result, context);
    },
  });
  function fencedCallbacks(callbacks?: MutateOptions<T, E, V, C>): MutateOptions<T, E, ScopedVariables, C> {
    return {
      onSuccess: (data, variables, result, context) => { if (variables.scope.isCurrent()) callbacks?.onSuccess?.(data, variables.value, result, context); },
      onError: (error, variables, result, context) => { if (variables.scope.isCurrent()) callbacks?.onError?.(error, variables.value, result, context); },
      onSettled: (data, error, variables, result, context) => { if (variables.scope.isCurrent()) callbacks?.onSettled?.(data, error, variables.value, result, context); },
    };
  }
  return {
    ...mutation,
    variables: mutation.variables?.value,
    mutate: (variables: V, callbacks?: MutateOptions<T, E, V, C>) => {
      if (scope.isCurrent() && state.status === "ready") mutation.mutate({ value: variables, scope }, fencedCallbacks(callbacks));
    },
    mutateAsync: (variables: V, callbacks?: MutateOptions<T, E, V, C>) =>
      inSessionScope(scope, () => mutation.mutateAsync({ value: variables, scope }, fencedCallbacks(callbacks))),
  };
}
