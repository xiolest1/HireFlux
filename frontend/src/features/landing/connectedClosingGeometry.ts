export interface ConnectedClosingOwner {
  refreshGeometry: () => void;
  finishForCodaFocus: (target: HTMLElement) => void;
}

export interface ConnectedClosingCallbacks {
  onClosingOwnerChange?: (owner: ConnectedClosingOwner | null) => void;
  onCodaEntryReadyChange?: (ready: boolean) => void;
}

export const connectedClosingReleaseRunoutPx = 32;

// offset geometry excludes both the envelope tween and Coda's CSS reveal.
export function untransformedLayoutTop(element: HTMLElement): number {
  let top = 0;
  let current: HTMLElement | null = element;
  while (current) {
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  return top;
}

export function connectedClosingPinTop(viewportHeight: number, stageHeight: number, postStoryFlowHeight: number) {
  if (![viewportHeight, stageHeight, postStoryFlowHeight].every(Number.isFinite)
    || viewportHeight <= 0 || stageHeight <= 0 || postStoryFlowHeight < 0) return 0;
  return Math.max(0, viewportHeight - stageHeight - postStoryFlowHeight + connectedClosingReleaseRunoutPx);
}

export function measureConnectedClosingGeometry(stage: HTMLElement, envelope: HTMLElement, codaFlow: HTMLElement | null, footer: HTMLElement | null, clearance: number) {
  const stageTop = untransformedLayoutTop(stage);
  const envelopeDelta = Math.max(0, stageTop + stage.offsetHeight - untransformedLayoutTop(envelope) - envelope.offsetHeight) + clearance;
  const footerStyle = footer ? getComputedStyle(footer) : null;
  const postStoryFlowHeight = codaFlow && footer
    ? untransformedLayoutTop(codaFlow) + codaFlow.offsetHeight - stageTop - stage.offsetHeight
      + footer.offsetHeight + (Number.parseFloat(footerStyle!.marginTop) || 0) + (Number.parseFloat(footerStyle!.marginBottom) || 0)
    : 0;
  return {
    envelopeDelta,
    pinTop: codaFlow && footer ? connectedClosingPinTop(window.innerHeight, stage.offsetHeight, postStoryFlowHeight) : 0,
    signature: [window.innerHeight, stage.offsetHeight, envelope.offsetHeight, envelopeDelta, postStoryFlowHeight].join(":"),
  };
}

export function readConnectedJ3ScrollRange(root: HTMLElement) {
  const j3 = root.querySelector<HTMLElement>("[data-connected-j3]");
  if (!j3?.hasAttribute("data-connected-scroll-start") || !j3.hasAttribute("data-connected-scroll-end")) return null;
  const start = Number(j3.dataset.connectedScrollStart);
  const end = Number(j3.dataset.connectedScrollEnd);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}
