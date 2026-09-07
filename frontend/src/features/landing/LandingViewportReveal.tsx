import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "../../components/ui/motionHooks";
import {
  createLandingRevealObserverOptions,
  landingRevealHandshakeMs,
} from "./landingViewportRevealConfig";

type RevealLifecycle = "uninitialized" | "pending" | "revealed";
type RevealMotion = "none" | "entry";
type RevealGeometry = "passed" | "reached" | "safely-below";

function classifyRevealGeometry(bounds: DOMRect, viewportHeight: number): RevealGeometry {
  // A one-pixel guard keeps near-boundary content fail-visible instead of
  // risking a visible final-to-pending paint during the layout handshake.
  if (bounds.top >= viewportHeight + 1) return "safely-below";
  if (bounds.bottom <= 0) return "passed";
  return "reached";
}

interface LandingViewportRevealProps {
  children: ReactNode;
  className?: string;
}

export function LandingViewportReveal({
  children,
  className = "",
}: LandingViewportRevealProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lifecycleRef = useRef<RevealLifecycle>("uninitialized");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const watchdogRef = useRef<number | null>(null);
  const [lifecycle, setLifecycle] = useState<RevealLifecycle>("revealed");
  const [motion, setMotion] = useState<RevealMotion>("none");
  const reducedMotion = useReducedMotion();

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current === null) return;
    window.clearTimeout(watchdogRef.current);
    watchdogRef.current = null;
  }, []);

  const disconnectObserver = useCallback(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, []);

  const reveal = useCallback((nextMotion: RevealMotion = "none") => {
    if (lifecycleRef.current === "revealed") return;
    lifecycleRef.current = "revealed";
    clearWatchdog();
    disconnectObserver();
    setMotion(nextMotion);
    setLifecycle("revealed");
  }, [clearWatchdog, disconnectObserver]);

  useLayoutEffect(() => {
    if (lifecycleRef.current === "revealed") return;

    if (reducedMotion) {
      reveal();
      return;
    }

    const root = rootRef.current;
    if (!root) {
      reveal();
      return;
    }

    const geometry = classifyRevealGeometry(
      root.getBoundingClientRect(),
      window.innerHeight,
    );
    if (geometry !== "safely-below") {
      reveal();
      return;
    }

    if (typeof window.IntersectionObserver !== "function") {
      reveal();
      return;
    }

    lifecycleRef.current = "pending";
    setMotion("none");
    setLifecycle("pending");
    let active = true;
    let initialResultReceived = false;

    try {
      // Threshold-zero observers can miss a target that jumps from below to
      // above between samples. Extending only the upper root by the initial
      // document height makes that passed state observable without scroll work.
      const passedSectionSafetyMargin = Math.max(
        document.documentElement.scrollHeight,
        window.innerHeight,
      );
      const observer = new window.IntersectionObserver((entries) => {
        if (!active) return;
        const entry = entries.find((candidate) => candidate.target === root);
        if (!entry || lifecycleRef.current !== "pending") return;

        if (!initialResultReceived) {
          // Scroll restoration and runtime pin spacing can invalidate the
          // observer's queued first sample. Reconcile that handshake against
          // the element's live position before accepting or acting on it.
          const currentGeometry = classifyRevealGeometry(
            root.getBoundingClientRect(),
            window.innerHeight,
          );
          initialResultReceived = true;
          clearWatchdog();

          if (currentGeometry === "safely-below") return;
          if (currentGeometry === "passed" || !entry.isIntersecting) {
            reveal();
            return;
          }

          reveal("entry");
          return;
        }

        if (entry.boundingClientRect.bottom <= 0) {
          reveal();
        } else if (entry.isIntersecting) {
          reveal("entry");
        }
      }, createLandingRevealObserverOptions(passedSectionSafetyMargin));
      observerRef.current = observer;
      observer.observe(root);

      if (lifecycleRef.current === "pending" && !initialResultReceived) {
        watchdogRef.current = window.setTimeout(() => {
          if (active) reveal();
        }, landingRevealHandshakeMs);
      }
    } catch {
      reveal();
    }

    return () => {
      active = false;
      clearWatchdog();
      disconnectObserver();
    };
  }, [clearWatchdog, disconnectObserver, reducedMotion, reveal]);

  function handleFocusCapture() {
    reveal();
  }

  return (
    <div
      ref={rootRef}
      className={`hf-landing-viewport-reveal ${className}`.trim()}
      data-landing-viewport-reveal
      data-reveal-state={lifecycle === "pending" ? "pending" : "revealed"}
      data-reveal-motion={motion}
      onFocusCapture={handleFocusCapture}
    >
      {children}
    </div>
  );
}
