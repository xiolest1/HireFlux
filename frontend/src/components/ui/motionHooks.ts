import { useEffect, useState } from "react";

export type PresenceState = "open" | "closed";

export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

export function usePresence(open: boolean, exitDuration = 140) {
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    if (reducedMotion) {
      setMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), exitDuration);
    return () => window.clearTimeout(timer);
  }, [exitDuration, mounted, open, reducedMotion]);

  return {
    mounted: open || mounted,
    state: (open ? "open" : "closed") as PresenceState,
    reducedMotion,
  };
}
