export interface ApplicationCreateRouteState {
  origin: "dashboard" | "applications";
  returnTo: string;
}

export interface ApplicationCreatedRouteState {
  notice: string;
  createdApplicationId: string;
  createdCompanyName: string;
  createdJobTitle: string;
}

export function applicationCreateRouteState(
  origin: ApplicationCreateRouteState["origin"],
  pathname: string,
  search: string,
): ApplicationCreateRouteState {
  return { origin, returnTo: `${pathname}${search}` };
}

export function readApplicationCreateRouteState(
  value: unknown,
): ApplicationCreateRouteState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ApplicationCreateRouteState>;
  if (
    (candidate.origin !== "dashboard" && candidate.origin !== "applications") ||
    typeof candidate.returnTo !== "string"
  ) {
    return null;
  }
  const expectedPath = candidate.origin === "dashboard" ? "/dashboard" : "/applications";
  return (
    candidate.returnTo === expectedPath ||
    candidate.returnTo.startsWith(`${expectedPath}?`)
  )
    ? (candidate as ApplicationCreateRouteState)
    : null;
}

export function readApplicationCreatedRouteState(
  value: unknown,
): ApplicationCreatedRouteState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ApplicationCreatedRouteState>;
  return typeof candidate.notice === "string" &&
    typeof candidate.createdApplicationId === "string" &&
    typeof candidate.createdCompanyName === "string" &&
    typeof candidate.createdJobTitle === "string"
    ? (candidate as ApplicationCreatedRouteState)
    : null;
}
