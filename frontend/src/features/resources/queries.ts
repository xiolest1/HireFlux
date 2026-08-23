import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  createInterview,
  createNote,
  deleteNote,
  getSettings,
  listApplicationInterviews,
  listNotes,
  listUpcomingInterviews,
  transitionInterview,
  updateInterview,
  updateInterviewWorkspace,
  updateNote,
  updateSettings,
  exportWorkspace,
  exportApplicationsCsv,
  type InterviewFields,
  type UpdateSettingsRequest,
} from "../../api/resources";
import type { InterviewStatus, InterviewWorkspace, Settings } from "../../api/schemas";
import {
  detectBrowserTimeZone,
  hasManualTimeZonePreference,
  markManualTimeZonePreference,
} from "../../auth/timeZonePreference";
import { applicationKeys } from "../applications/queries";

export const resourceKeys = {
  settings: ["settings"] as const,
  notes: (applicationId: string) => ["applications", applicationId, "notes"] as const,
  applicationInterviews: (applicationId: string) => ["applications", applicationId, "interviews"] as const,
  upcomingInterviews: ["interviews", "upcoming"] as const,
};

export function useSettings({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: resourceKeys.settings,
    queryFn: ({ signal }) => getSettings(signal),
    enabled,
  });
}

export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: UpdateSettingsRequest) => updateSettings(request),
    onSuccess: (settings, request) => {
      if (request.time_zone !== undefined) markManualTimeZonePreference();
      client.setQueryData(resourceKeys.settings, settings);
    },
  });
}

export function useAutoDetectTimeZone(
  settings: Settings | undefined,
  enabled: boolean,
): void {
  const client = useQueryClient();
  const attemptedZone = useRef<string | null>(null);

  useEffect(() => {
    if (
      !enabled ||
      !settings ||
      hasManualTimeZonePreference()
    ) {
      return;
    }
    const browserTimeZone = detectBrowserTimeZone();
    if (
      !browserTimeZone ||
      browserTimeZone === "UTC" ||
      attemptedZone.current === browserTimeZone
    ) {
      return;
    }
    attemptedZone.current = browserTimeZone;
    let active = true;
    void updateSettings({
      expected_version: settings.version,
      time_zone: browserTimeZone,
    })
      .then((nextSettings) => {
        if (active) client.setQueryData(resourceKeys.settings, nextSettings);
      })
      .catch(() => {
        // UTC remains a safe fallback when the automatic preference cannot be saved.
      });
    return () => {
      active = false;
    };
  }, [client, enabled, settings]);
}

export function useExportWorkspace() {
  return useMutation({ mutationFn: exportWorkspace });
}

export function useExportApplicationsCsv() {
  return useMutation({ mutationFn: exportApplicationsCsv });
}

export function useNotes(applicationId: string) {
  return useInfiniteQuery({
    queryKey: resourceKeys.notes(applicationId),
    queryFn: ({ signal, pageParam }) => listNotes(applicationId, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: Boolean(applicationId),
  });
}

function useResourceInvalidation(applicationId: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: applicationKeys.activity(applicationId) });
    void client.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useCreateNote(applicationId: string) {
  const client = useQueryClient();
  const invalidateRelated = useResourceInvalidation(applicationId);
  return useMutation({
    mutationFn: (content: string) => createNote(applicationId, content),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: resourceKeys.notes(applicationId) });
      invalidateRelated();
    },
  });
}

export function useUpdateNote(applicationId: string) {
  const client = useQueryClient();
  const invalidateRelated = useResourceInvalidation(applicationId);
  return useMutation({
    mutationFn: ({ noteId, version, content }: { noteId: string; version: number; content: string }) =>
      updateNote(applicationId, noteId, version, content),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: resourceKeys.notes(applicationId) });
      invalidateRelated();
    },
  });
}

export function useDeleteNote(applicationId: string) {
  const client = useQueryClient();
  const invalidateRelated = useResourceInvalidation(applicationId);
  return useMutation({
    mutationFn: ({ noteId, version }: { noteId: string; version: number }) =>
      deleteNote(applicationId, noteId, version),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: resourceKeys.notes(applicationId) });
      invalidateRelated();
    },
  });
}

export function useApplicationInterviews(applicationId: string) {
  return useInfiniteQuery({
    queryKey: resourceKeys.applicationInterviews(applicationId),
    queryFn: ({ signal, pageParam }) =>
      listApplicationInterviews(applicationId, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: Boolean(applicationId),
  });
}

export function useUpcomingInterviews() {
  return useInfiniteQuery({
    queryKey: resourceKeys.upcomingInterviews,
    queryFn: ({ signal, pageParam }) => listUpcomingInterviews(pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

function useInterviewInvalidation(applicationId: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: resourceKeys.applicationInterviews(applicationId) });
    void client.invalidateQueries({ queryKey: resourceKeys.upcomingInterviews });
    void client.invalidateQueries({ queryKey: applicationKeys.activity(applicationId) });
    void client.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useCreateInterview(applicationId: string) {
  const invalidate = useInterviewInvalidation(applicationId);
  return useMutation({
    mutationFn: (fields: InterviewFields) => createInterview(applicationId, fields),
    onSuccess: invalidate,
  });
}

export function useUpdateInterview(applicationId: string) {
  const invalidate = useInterviewInvalidation(applicationId);
  return useMutation({
    mutationFn: ({ interviewId, version, fields }: { interviewId: string; version: number; fields: Partial<InterviewFields> }) =>
      updateInterview(applicationId, interviewId, version, fields),
    onSuccess: invalidate,
  });
}

export function useTransitionInterview(applicationId: string) {
  const invalidate = useInterviewInvalidation(applicationId);
  return useMutation({
    mutationFn: ({ interviewId, version, status }: { interviewId: string; version: number; status: Extract<InterviewStatus, "COMPLETED" | "CANCELED"> }) =>
      transitionInterview(applicationId, interviewId, version, status),
    onSuccess: invalidate,
  });
}

export function useUpdateInterviewWorkspace(applicationId: string) {
  const invalidate = useInterviewInvalidation(applicationId);
  return useMutation({
    mutationFn: ({
      interviewId,
      version,
      workspace,
      debriefComplete,
    }: {
      interviewId: string;
      version: number;
      workspace: InterviewWorkspace;
      debriefComplete: boolean;
    }) =>
      updateInterviewWorkspace(
        applicationId,
        interviewId,
        version,
        workspace,
        debriefComplete,
      ),
    onSuccess: invalidate,
  });
}
