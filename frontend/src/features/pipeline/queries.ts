import { useWorkspaceQuery } from "../../auth/workspaceQueries";
import { getPipeline } from "../../api/pipeline";

export const pipelineKeys = {
  all: ["pipeline"] as const,
  board: () => [...pipelineKeys.all, "board"] as const,
};

export function usePipeline({ enabled = true }: { enabled?: boolean } = {}) {
  return useWorkspaceQuery({
    queryKey: pipelineKeys.board(),
    queryFn: ({ signal }) => getPipeline(signal),
    enabled,
  });
}
