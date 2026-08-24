import { useQuery } from "@tanstack/react-query";
import { getPipeline } from "../../api/pipeline";

export const pipelineKeys = {
  all: ["pipeline"] as const,
  board: () => [...pipelineKeys.all, "board"] as const,
};

export function usePipeline({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: pipelineKeys.board(),
    queryFn: ({ signal }) => getPipeline(signal),
    enabled,
  });
}
