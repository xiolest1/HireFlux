import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { StaleSessionError } from "../auth/sessionGeneration";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof StaleSessionError) return false;
          if (error instanceof ApiError && error.status !== null) {
            return error.status >= 500 && failureCount < 1;
          }
          return failureCount < 1;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
