import { useRef } from "react";
import { useReducedMotion } from "../../components/ui/motionHooks";

export function useHeroMotionSession() {
  const currentReducedMotion = useReducedMotion();
  const motionEligibleRef = useRef(!currentReducedMotion);

  // A Hero may lose motion authority during a mount; only a fresh mount restores it.
  if (currentReducedMotion) motionEligibleRef.current = false;

  const heroMotionEligible = motionEligibleRef.current;

  return {
    currentReducedMotion,
    heroMotionEligible,
    heroMotionActive: heroMotionEligible && !currentReducedMotion,
  };
}
