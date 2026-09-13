import {
  connectedStoryCConfiguration,
  type ConnectedStoryCProgressiveCapability,
} from "./connectedStoryCConfig";

export function connectedJ3PreflightFits(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>("[data-connected-j3-fit-stage]");
  const envelope = root.querySelector<HTMLElement>("[data-connected-j3-fit-envelope]");
  const shell = root.querySelector<HTMLElement>("[data-connected-j3-fit-shell]");
  if (!stage || !envelope || !shell || stage.offsetHeight === 0) return false;
  if (stage.offsetHeight > window.innerHeight + 1) return false;
  if (shell.offsetHeight > envelope.clientHeight + 1) return false;
  return Array.from(
    root.querySelectorAll<HTMLElement>("[data-connected-j3-fit-copy]"),
  ).every((copy) => copy.scrollHeight <= copy.clientHeight + 1);
}

export interface ConnectedStoryCProgressiveFitInput {
  width: number;
  usableHeight: number;
  containerWidth: number;
  rootFontPx: number;
  progressiveAllowed: boolean;
  reducedMotion: boolean;
  intersectionObserverAvailable: boolean;
  stickySupported: boolean;
  currentlyProgressive: boolean;
}

export interface ConnectedStoryCProgressiveFitResult {
  capability: ConnectedStoryCProgressiveCapability;
  signature: string;
  endpointsFit: boolean;
}

export function connectedStoryCProgressiveFitSignature(
  input: Pick<ConnectedStoryCProgressiveFitInput, "width" | "usableHeight" | "containerWidth" | "rootFontPx">,
) {
  return [input.width, input.usableHeight, input.containerWidth, input.rootFontPx].map((value) => Math.round(value * 10) / 10).join(":");
}

export function connectedStoryCProgressivePreflightFits(
  root: HTMLElement,
  input: ConnectedStoryCProgressiveFitInput,
): ConnectedStoryCProgressiveFitResult {
  const config = connectedStoryCConfiguration;
  const signature = connectedStoryCProgressiveFitSignature(input);
  const hardFailure = !input.progressiveAllowed
    || input.reducedMotion
    || !input.intersectionObserverAvailable
    || !input.stickySupported
    || !Number.isFinite(input.usableHeight);
  if (hardFailure) return { capability: "ineligible", signature, endpointsFit: false };

  const stage = root.querySelector<HTMLElement>("[data-connected-c-fit-stage]");
  const envelope = root.querySelector<HTMLElement>("[data-connected-c-fit-envelope]");
  const endpoints = Array.from(root.querySelectorAll<HTMLElement>("[data-connected-c-fit-endpoint]"));
  if (!stage || !envelope || endpoints.length !== 4 || stage.offsetWidth === 0) {
    return { capability: "ineligible", signature, endpointsFit: false };
  }

  const endpointsFit = endpoints.every((endpoint) => {
    const frame = endpoint.querySelector<HTMLElement>("[data-connected-workspace-frame]");
    return Boolean(frame)
      && frame!.scrollHeight <= Math.max(config.shellHeightPx, envelope.clientHeight) + config.fitTolerancePx;
  });
  const requiredReserve = input.currentlyProgressive ? config.retentionReservePx : config.entryReservePx;
  const capacityFits = input.width >= config.minWidth
    && input.usableHeight >= config.minUsableHeight + requiredReserve
    && input.containerWidth >= config.minContainerWidth
    && input.rootFontPx <= config.maxRootFontPx;

  if (capacityFits && endpointsFit) return { capability: "eligible", signature, endpointsFit: true };
  const retainable = input.currentlyProgressive
    && endpointsFit
    && input.width >= config.minWidth - config.retentionReservePx
    && input.usableHeight >= config.minUsableHeight - config.retentionReservePx
    && input.containerWidth >= config.minContainerWidth - config.retentionReservePx
    && input.rootFontPx <= config.maxRootFontPx;
  return { capability: retainable ? "retainable" : "ineligible", signature, endpointsFit };
}
