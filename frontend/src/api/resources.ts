import { z } from "zod";
import { apiDownload, apiRequest } from "./client";
import {
  interviewListResponseSchema,
  interviewSchema,
  workspaceInterviewListResponseSchema,
  noteListResponseSchema,
  notePreviewResponseSchema,
  noteSchema,
  settingsSchema,
  workspaceExportSchema,
  type ColorTheme,
  type DashboardRange,
  type Interview,
  type InterviewStatus,
  type InterviewType,
  type InterviewWorkspace,
  type Note,
  type Settings,
} from "./schemas";

export interface UpdateSettingsRequest {
  expected_version: number;
  time_zone?: string;
  default_follow_up_days?: number;
  default_application_view?: "ACTIVE" | "ALL" | "ARCHIVED";
  default_dashboard_range?: DashboardRange;
  theme?: ColorTheme;
}

export interface InterviewFields {
  interview_type: InterviewType;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  meeting_url: string | null;
  details: string | null;
}

export function getSettings(signal?: AbortSignal): Promise<Settings> {
  return apiRequest("/api/v1/settings", settingsSchema, { signal });
}

export function updateSettings(request: UpdateSettingsRequest): Promise<Settings> {
  return apiRequest("/api/v1/settings", settingsSchema, {
    method: "PATCH",
    json: request,
  });
}

export function exportWorkspace() {
  return apiRequest("/api/v1/me/export", workspaceExportSchema);
}

export function exportApplicationsCsv() {
  return apiDownload("/api/v1/me/applications/export");
}

export function listNotes(
  applicationId: string,
  cursor: string | null,
  signal?: AbortSignal,
) {
  const search = new URLSearchParams({ limit: "25" });
  if (cursor) search.set("cursor", cursor);
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}/notes?${search.toString()}`,
    noteListResponseSchema,
    { signal },
  );
}

export function getNotePreview(
  applicationId: string,
  limit = 2,
  signal?: AbortSignal,
) {
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}/notes/preview?limit=${limit}`,
    notePreviewResponseSchema,
    { signal },
  );
}

export function createNote(applicationId: string, content: string): Promise<Note> {
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}/notes`,
    noteSchema,
    { method: "POST", json: { content } },
  );
}

export function updateNote(
  applicationId: string,
  noteId: string,
  expectedVersion: number,
  content: string,
): Promise<Note> {
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}/notes/${encodeURIComponent(noteId)}`,
    noteSchema,
    { method: "PATCH", json: { expected_version: expectedVersion, content } },
  );
}

export function deleteNote(
  applicationId: string,
  noteId: string,
  expectedVersion: number,
): Promise<null> {
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}/notes/${encodeURIComponent(noteId)}?expected_version=${expectedVersion}`,
    z.null(),
    { method: "DELETE" },
  );
}

export function listApplicationInterviews(
  applicationId: string,
  cursor: string | null,
  signal?: AbortSignal,
) {
  const search = new URLSearchParams({ limit: "25" });
  if (cursor) search.set("cursor", cursor);
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}/interviews?${search.toString()}`,
    interviewListResponseSchema,
    { signal },
  );
}

export function listUpcomingInterviews(cursor: string | null, signal?: AbortSignal) {
  const search = new URLSearchParams({ limit: "20" });
  if (cursor) search.set("cursor", cursor);
  return apiRequest(`/api/v1/interviews?${search.toString()}`, interviewListResponseSchema, {
    signal,
  });
}

export function listWorkspaceInterviews(
  view: "UPCOMING" | "ALL",
  cursor: string | null,
  signal?: AbortSignal,
) {
  const search = new URLSearchParams({ limit: "20", view });
  if (cursor) search.set("cursor", cursor);
  return apiRequest(
    `/api/v1/interviews?${search.toString()}`,
    workspaceInterviewListResponseSchema,
    { signal },
  );
}

export function createInterview(applicationId: string, fields: InterviewFields): Promise<Interview> {
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}/interviews`,
    interviewSchema,
    { method: "POST", json: fields },
  );
}

export function updateInterview(
  applicationId: string,
  interviewId: string,
  expectedVersion: number,
  fields: Partial<InterviewFields>,
): Promise<Interview> {
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}/interviews/${encodeURIComponent(interviewId)}`,
    interviewSchema,
    { method: "PATCH", json: { expected_version: expectedVersion, ...fields } },
  );
}

export function transitionInterview(
  applicationId: string,
  interviewId: string,
  expectedVersion: number,
  status: Extract<InterviewStatus, "COMPLETED" | "CANCELED">,
): Promise<Interview> {
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}/interviews/${encodeURIComponent(interviewId)}/status`,
    interviewSchema,
    { method: "POST", json: { expected_version: expectedVersion, status } },
  );
}

export function updateInterviewWorkspace(
  applicationId: string,
  interviewId: string,
  expectedVersion: number,
  workspace: InterviewWorkspace,
  debriefComplete: boolean,
): Promise<Interview> {
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}/interviews/${encodeURIComponent(interviewId)}/workspace`,
    interviewSchema,
    {
      method: "PATCH",
      json: {
        expected_version: expectedVersion,
        ...workspace,
        debrief_complete: debriefComplete,
      },
    },
  );
}

export function createPreparationItem(
  applicationId: string,
  interviewId: string,
  expectedVersion: number,
  label: string,
): Promise<Interview> {
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}/interviews/${encodeURIComponent(interviewId)}/preparation-items`,
    interviewSchema,
    {
      method: "POST",
      json: { expected_version: expectedVersion, label },
    },
  );
}

export function deletePreparationItem(
  applicationId: string,
  interviewId: string,
  itemId: string,
  expectedVersion: number,
): Promise<Interview> {
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(applicationId)}/interviews/${encodeURIComponent(interviewId)}/preparation-items/${encodeURIComponent(itemId)}?expected_version=${expectedVersion}`,
    interviewSchema,
    { method: "DELETE" },
  );
}
