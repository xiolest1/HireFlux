import { z } from "zod";

const DEFAULT_API_BASE_URL = "http://localhost:8000";

function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  const value = configured || DEFAULT_API_BASE_URL;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported protocol");
    }
  } catch {
    throw new Error(
      "VITE_API_BASE_URL must be an absolute http:// or https:// URL.",
    );
  }

  return value.replace(/\/+$/, "");
}

const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
    request_id: z.string().optional(),
  }),
});

export class ApiError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly details: unknown;
  readonly requestId: string | null;

  constructor(
    code: string,
    message: string,
    status: number | null = null,
    details?: unknown,
    requestId?: string | null,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId ?? null;
  }
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  json?: unknown;
};

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorFromResponse(response: Response, payload: unknown): ApiError {
  const parsed = errorEnvelopeSchema.safeParse(payload);
  if (parsed.success) {
    const error = parsed.data.error;
    return new ApiError(
      error.code,
      error.message,
      response.status,
      error.details,
      error.request_id ?? response.headers.get("x-request-id"),
    );
  }

  if (
    payload &&
    typeof payload === "object" &&
    "detail" in payload &&
    typeof payload.detail === "string"
  ) {
    return new ApiError(
      "REQUEST_FAILED",
      payload.detail,
      response.status,
      undefined,
      response.headers.get("x-request-id"),
    );
  }

  return new ApiError(
    "REQUEST_FAILED",
    "The request could not be completed. Please try again.",
    response.status,
    undefined,
    response.headers.get("x-request-id"),
  );
}

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  let body: string | undefined;
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  }

  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      ...options,
      headers,
      body,
    });
    const payload = await readJson(response);

    if (!response.ok) {
      throw errorFromResponse(response, payload);
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError(
        "INVALID_RESPONSE",
        "The server returned an unexpected response.",
        response.status,
      );
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(
      "NETWORK_ERROR",
      "HireFlux could not reach the API. Check that the backend is running.",
    );
  }
}
