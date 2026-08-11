import {
  activityListResponseSchema,
  applicationListResponseSchema,
  applicationSchema,
  type Application,
  type ApplicationListResponse,
  type ApplicationStatus,
  type WorkMode,
  type Activity,
  userSchema,
  type User,
} from "./schemas";
import { apiRequest } from "./client";

export interface ApplicationFields {
  company_name: string;
  job_title: string;
  applied_date: string | null;
  follow_up_date: string | null;
  job_url: string | null;
  location: string | null;
  work_mode: WorkMode | null;
  source: string | null;
  salary_text: string | null;
  description: string | null;
}

export interface CreateApplicationRequest extends ApplicationFields {
  status: Extract<ApplicationStatus, "DRAFT" | "APPLIED">;
}

export interface UpdateApplicationRequest extends ApplicationFields {
  expected_version: number;
}

export interface TransitionApplicationRequest {
  status: ApplicationStatus;
  expected_version: number;
  applied_date?: string;
}

export function getMe(signal?: AbortSignal): Promise<User> {
  return apiRequest("/api/v1/me", userSchema, { signal });
}

export function listApplications(
  cursor: string | null,
  signal?: AbortSignal,
  limit = 20,
  status?: ApplicationStatus,
): Promise<ApplicationListResponse> {
  const search = new URLSearchParams({ limit: String(limit) });
  if (cursor) {
    search.set("cursor", cursor);
  }
  if (status) {
    search.set("status", status);
  }
  return apiRequest(
    `/api/v1/applications?${search.toString()}`,
    applicationListResponseSchema,
    { signal },
  );
}

export function getApplication(
  applicationId: string,
  signal?: AbortSignal,
): Promise<Application> {
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}`,
    applicationSchema,
    { signal },
  );
}

export function createApplication(
  request: CreateApplicationRequest,
): Promise<Application> {
  return apiRequest("/api/v1/applications", applicationSchema, {
    method: "POST",
    json: request,
  });
}

export function updateApplication(
  applicationId: string,
  request: UpdateApplicationRequest,
): Promise<Application> {
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}`,
    applicationSchema,
    { method: "PATCH", json: request },
  );
}

export function transitionApplication(
  applicationId: string,
  request: TransitionApplicationRequest,
): Promise<Application> {
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}/status`,
    applicationSchema,
    { method: "POST", json: request },
  );
}

export async function listApplicationActivity(
  applicationId: string,
  signal?: AbortSignal,
): Promise<{ items: Activity[] }> {
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}/activity`,
    activityListResponseSchema,
    { signal },
  );
}
