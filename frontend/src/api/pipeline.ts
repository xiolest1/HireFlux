import { pipelineResponseSchema, type Pipeline } from "./schemas";
import { apiRequest } from "./client";

export function getPipeline(signal?: AbortSignal): Promise<Pipeline> {
  return apiRequest("/api/v1/pipeline", pipelineResponseSchema, { signal });
}
