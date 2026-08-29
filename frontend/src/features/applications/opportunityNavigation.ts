export type ApplicationsDownstreamIntent =
  | "RUN_PRIMARY_ACTION"
  | "OPEN_INTERVIEW_PREPARATION";

export interface ApplicationsRouteState {
  applicationsOrigin: {
    returnTo: string;
    intent?: ApplicationsDownstreamIntent;
  };
}

export function applicationsRouteState(
  pathname: string,
  search: string,
  intent?: ApplicationsDownstreamIntent,
): ApplicationsRouteState {
  return {
    applicationsOrigin: {
      returnTo: `${pathname}${search}`,
      ...(intent ? { intent } : {}),
    },
  };
}

export function readApplicationsRouteState(
  value: unknown,
): ApplicationsRouteState["applicationsOrigin"] | null {
  if (!value || typeof value !== "object") return null;
  const origin = (value as Partial<ApplicationsRouteState>).applicationsOrigin;
  if (!origin || typeof origin !== "object") return null;
  if (
    typeof origin.returnTo !== "string" ||
    !(
      origin.returnTo === "/applications" ||
      origin.returnTo.startsWith("/applications?")
    )
  ) {
    return null;
  }
  if (
    origin.intent !== undefined &&
    origin.intent !== "RUN_PRIMARY_ACTION" &&
    origin.intent !== "OPEN_INTERVIEW_PREPARATION"
  ) {
    return null;
  }
  return origin;
}

export function applicationsRouteStateWithoutIntent(
  origin: ApplicationsRouteState["applicationsOrigin"],
): ApplicationsRouteState {
  return { applicationsOrigin: { returnTo: origin.returnTo } };
}
