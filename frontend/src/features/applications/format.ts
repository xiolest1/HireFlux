import type {
  ApplicationSource,
  ApplicationStatus,
  InterviewStatus,
  InterviewType,
  WorkMode,
} from "../../api/schemas";

const statusLabels: Record<ApplicationStatus, string> = {
  DRAFT: "Draft",
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  ARCHIVED: "Archived",
};

const sourceLabels: Record<ApplicationSource, string> = {
  LINKEDIN: "LinkedIn",
  INDEED: "Indeed",
  COMPANY_WEBSITE: "Company website",
  RECRUITER: "Recruiter",
  REFERRAL: "Referral",
  HANDSHAKE: "Handshake",
  CAREER_FAIR: "Career fair",
  OTHER: "Other",
};

const interviewTypeLabels: Record<InterviewType, string> = {
  RECRUITER_CALL: "Recruiter call",
  TECHNICAL_SCREEN: "Technical screen",
  BEHAVIORAL: "Behavioral interview",
  CODING_ASSESSMENT: "Coding assessment",
  HIRING_MANAGER: "Hiring manager",
  ONSITE: "On-site interview",
  FINAL: "Final interview",
  OTHER: "Other interview",
};

export function formatStatus(status: ApplicationStatus): string {
  return statusLabels[status];
}

export function formatSource(source: ApplicationSource): string {
  return sourceLabels[source];
}

export function formatWorkMode(workMode: WorkMode): string {
  return workMode === "ONSITE" ? "On-site" : workMode.charAt(0) + workMode.slice(1).toLowerCase();
}

export function formatInterviewType(type: InterviewType): string {
  return interviewTypeLabels[type];
}

export function formatInterviewStatus(status: InterviewStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function formatDateOnly(value: string | null): string {
  if (!value) return "Not set";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatTimestamp(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}
