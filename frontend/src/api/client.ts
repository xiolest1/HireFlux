import { z } from "zod";
import { requestScope, StaleSessionError, type SessionScope } from "../auth/sessionGeneration";

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

export interface DownloadedFile {
  blob: Blob;
  filename: string;
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  json?: unknown;
  scope?: SessionScope;
  publicRequest?: boolean;
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
  const scope = options.scope ?? requestScope();
  scope.assertCurrent();
  const { scope: _scope, publicRequest, json, ...requestOptions } = options;
  void _scope;
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.delete("Authorization");
  if (!publicRequest && scope.authorization) headers.set("Authorization", scope.authorization);

  let body: string | undefined;
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }

  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      ...requestOptions,
      headers,
      body,
    });
    scope.assertCurrent();
    const payload = await readJson(response);
    scope.assertCurrent();

    if (!response.ok) {
      const apiError = errorFromResponse(response, payload);
      if (response.status === 401 && !publicRequest) scope.unauthorized(apiError.code === "DEMO_SESSION_EXPIRED" ? "expired" : "invalidated");
      throw apiError;
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
    if (error instanceof StaleSessionError) throw error;
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    scope.assertCurrent();
    throw new ApiError(
      "NETWORK_ERROR",
      "HireFlux could not reach the API. Check that the backend is running.",
    );
  }
}

export async function apiDownload(path: string, scope = requestScope()): Promise<DownloadedFile> {
  scope.assertCurrent();
  const headers = new Headers({ Accept: "text/csv" });
  if (scope.authorization) headers.set("Authorization", scope.authorization);

  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, { headers });
    scope.assertCurrent();
    const payload = await readJson(response);
    scope.assertCurrent();
    if (!response.ok) {
      const apiError = errorFromResponse(response, payload);
      if (response.status === 401) scope.unauthorized(apiError.code === "DEMO_SESSION_EXPIRED" ? "expired" : "invalidated");
      throw apiError;
    }

    const blob = await response.blob();
    scope.assertCurrent();
    return {
      blob,
      filename: parseDownloadFilename(response.headers.get("Content-Disposition")),
    };
  } catch (error) {
    if (error instanceof StaleSessionError) throw error;
    if (error instanceof ApiError) throw error;
    scope.assertCurrent();
    throw new ApiError(
      "NETWORK_ERROR",
      "HireFlux could not reach the API. Check that the backend is running.",
    );
  }
}

function parseDownloadFilename(disposition: string | null): string {
  const utf8Match = disposition?.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return "hireflux-applications.csv";
    }
  }
  const filenameMatch = disposition?.match(/filename="?([^";]+)"?/i);
  return filenameMatch?.[1] ?? "hireflux-applications.csv";
}
