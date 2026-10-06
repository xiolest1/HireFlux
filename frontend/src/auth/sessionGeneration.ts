/** Each request and continuation retains its original, immutable session scope. */
export class StaleSessionError extends Error {
  constructor() {
    super("This operation belongs to a workspace that is no longer active.");
    this.name = "StaleSessionError";
  }
}

export interface SessionScope {
  readonly generation: number;
  readonly authorization: string | null;
  isCurrent(): boolean;
  assertCurrent(): void;
  unauthorized(reason: "expired" | "invalidated"): void;
}

let generation = 0;
let current: SessionScope;

export function newSessionScope(
  authorization: string | null = null,
  onUnauthorized: (reason: "expired" | "invalidated") => void = () => {},
): SessionScope {
  const scope: SessionScope = {
    generation: ++generation,
    authorization,
    isCurrent: () => current === scope,
    assertCurrent: () => {
      if (current !== scope) throw new StaleSessionError();
    },
    unauthorized: (reason) => {
      if (current === scope) onUnauthorized(reason);
    },
  };
  current = scope;
  return scope;
}

newSessionScope();
export function requestScope(): SessionScope {
  return current;
}
export function bindRequestScope(scope: SessionScope): void { current = scope; }

export async function inSessionScope<T>(scope: SessionScope, operation: () => Promise<T>): Promise<T> {
  scope.assertCurrent();
  try {
    const result = await operation();
    scope.assertCurrent();
    return result;
  } catch (error) {
    scope.assertCurrent();
    throw error;
  }
}

/** No async gap exists between the final check and exposing a browser download. */
export function downloadInSession(scope: SessionScope, blob: Blob, filename: string): void {
  scope.assertCurrent();
  const url = URL.createObjectURL(blob);
  try {
    scope.assertCurrent();
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
