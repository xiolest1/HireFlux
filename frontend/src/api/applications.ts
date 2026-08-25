import {
  activityListResponseSchema,
  applicationListResponseSchema,
  applicationSchema,
  type Application,
  type ApplicationListResponse,
  type ApplicationStatus,
  type ApplicationSource,
  type ApplicationSort,
  type ApplicationView,
  type StageAgeBucket,
  type FollowUpFilter,
  type RoleFamily,
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
  source: ApplicationSource | null;
  source_detail: string | null;
  salary_text: string | null;
  description: string | null;
  role_family: RoleFamily | null;
}

export interface CreateApplicationRequest extends ApplicationFields {
  status: Extract<ApplicationStatus, "DRAFT" | "APPLIED">;
}

export interface UpdateApplicationRequest extends Partial<ApplicationFields> {
  expected_version: number;
}

export interface TransitionApplicationRequest {
  status: ApplicationStatus;
  expected_version: number;
  applied_date?: string;
}

export interface ApplicationListFilters {
  q?: string;
  source?: ApplicationSource;
  workMode?: WorkMode;
  sort?: ApplicationSort;
  view?: ApplicationView;
  stageAge?: StageAgeBucket;
  followUp?: FollowUpFilter;
}

export function getMe(signal?: AbortSignal): Promise<User> {
  return apiRequest("/api/v1/me", userSchema, { signal });
}

export function listApplications(
  cursor: string | null,
  signal?: AbortSignal,
  limit = 20,
  status?: ApplicationStatus,
  filters: ApplicationListFilters = {},
): Promise<ApplicationListResponse> {
  const search = new URLSearchParams({ limit: String(limit) });
  if (cursor) {
    search.set("cursor", cursor);
  }
  if (status) {
    search.set("status", status);
  }
  if (filters.q) search.set("q", filters.q);
  if (filters.source) search.set("source", filters.source);
  if (filters.workMode) search.set("work_mode", filters.workMode);
  if (filters.sort) search.set("sort", filters.sort);
  if (filters.view) search.set("view", filters.view);
  if (filters.stageAge) search.set("stage_age", filters.stageAge);
  if (filters.followUp) search.set("follow_up", filters.followUp);
  return apiRequest(
    `/api/v1/applications?${search.toString()}`,
    applicationListResponseSchema,
    { signal },
  );
}

export function completeFollowUp(
  applicationId: string,
  expectedVersion: number,
): Promise<Application> {
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}/follow-up/complete`,
    applicationSchema,
    { method: "POST", json: { expected_version: expectedVersion } },
  );
}

export function rescheduleFollowUp(
  applicationId: string,
  expectedVersion: number,
  followUpDate: string,
): Promise<Application> {
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}/follow-up/reschedule`,
    applicationSchema,
    {
      method: "POST",
      json: { expected_version: expectedVersion, follow_up_date: followUpDate },
    },
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
  cursor: string | null,
  signal?: AbortSignal,
  limit = 25,
  order: "asc" | "desc" = "asc",
): Promise<{ items: Activity[]; next_cursor: string | null }> {
  const search = new URLSearchParams({ limit: String(limit), order });
  if (cursor) search.set("cursor", cursor);
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}/activity?${search.toString()}`,
    activityListResponseSchema,
    { signal },
  );
}
