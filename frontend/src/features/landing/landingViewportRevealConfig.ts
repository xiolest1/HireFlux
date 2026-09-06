export const landingRevealHandshakeMs = 300;
export const landingRevealBottomRootMargin = "-12%";
export const landingRevealObserverThreshold = 0;

export function createLandingRevealObserverOptions(
  passedSectionSafetyMargin: number,
): IntersectionObserverInit {
  return {
    root: null,
    rootMargin: `${Math.ceil(passedSectionSafetyMargin)}px 0px ${landingRevealBottomRootMargin} 0px`,
    threshold: landingRevealObserverThreshold,
  };
}
