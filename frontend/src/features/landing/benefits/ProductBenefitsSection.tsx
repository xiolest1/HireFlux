/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The reduced-motion fallback is a native horizontal scroll region. */
import { Pause, Play } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "../../../components/ui/motionHooks";
import { IconButton } from "../../../components/ui/IconButton";
import { BenefitSignal } from "./BenefitSignal";
import { benefitSignals } from "./benefitsModel";

export const benefitStreamPixelsPerSecond = 28;

export function ProductBenefitsSection() {
  const reducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const realGroupRef = useRef<HTMLOListElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (reducedMotion) {
      const track = trackRef.current;
      if (track) {
        track.style.removeProperty("--hf-benefits-loop-distance");
        track.style.removeProperty("--hf-benefits-loop-translation");
        track.style.removeProperty("--hf-benefits-loop-duration");
        delete track.dataset.loopDistance;
        delete track.dataset.loopDuration;
        delete track.dataset.motionReady;
      }
      return;
    }

    const realGroup = realGroupRef.current;
    const track = trackRef.current;
    if (!realGroup || !track) return;

    const measure = () => {
      const distance = realGroup.getBoundingClientRect().width;
      if (distance <= 0) return;
      const duration = distance / benefitStreamPixelsPerSecond;
      track.style.setProperty("--hf-benefits-loop-distance", `${distance}px`);
      track.style.setProperty("--hf-benefits-loop-translation", `${-distance}px`);
      track.style.setProperty("--hf-benefits-loop-duration", `${duration}s`);
      track.dataset.loopDistance = distance.toFixed(3);
      track.dataset.loopDuration = duration.toFixed(3);
      track.dataset.motionReady = "true";
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(realGroup);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <section
      className="mx-auto max-w-7xl min-w-0 px-4 pt-14 sm:px-6 sm:pt-20 lg:px-8"
      aria-labelledby="product-benefits-title"
      data-product-benefits
    >
      <div className="relative max-w-xl pr-14" data-landing-clip-check>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700 sm:text-sm">Why HireFlux</p>
        <h2 id="product-benefits-title" className="mt-2.5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl dark:text-white">
          A clearer way through the search.
        </h2>
        {!reducedMotion ? (
          <IconButton
            className="absolute right-0 top-0"
            label={paused ? "Play benefit stream" : "Pause benefit stream"}
            aria-controls="benefit-signals-viewport"
            onClick={() => setPaused((current) => !current)}
            data-benefits-motion-control
          >
            {paused ? <Play aria-hidden="true" className="size-4" /> : <Pause aria-hidden="true" className="size-4" />}
          </IconButton>
        ) : null}
      </div>
      <div
        id="benefit-signals-viewport"
        className={`hf-benefits-viewport -mx-4 mt-6 pb-2 ${reducedMotion ? "overflow-x-auto overscroll-x-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas" : "overflow-hidden"} sm:-mx-6 lg:-mx-8`}
        role="region"
        aria-label="Benefit signals"
        tabIndex={reducedMotion ? 0 : undefined}
        data-benefits-motion={reducedMotion ? "static" : "ambient"}
        data-benefits-viewport
      >
        <div
          ref={trackRef}
          className="hf-benefits-track flex w-max pl-4 sm:pl-6 lg:pl-8"
          data-motion-state={reducedMotion ? "static" : paused ? "paused" : "playing"}
          data-benefits-track
        >
          <ol
            ref={realGroupRef}
            className={`flex w-max shrink-0 gap-3 pr-3 sm:gap-4 sm:pr-4 ${reducedMotion ? "snap-x snap-proximity" : ""}`}
            data-benefit-real-group
          >
            {benefitSignals.map((signal) => (
              <li
                key={signal.id}
                className={`w-[calc(100vw-4.25rem)] shrink-0 sm:w-auto ${reducedMotion ? "snap-start" : ""}`}
              >
                <BenefitSignal signal={signal} />
              </li>
            ))}
          </ol>
          {!reducedMotion ? (
            <div
              className="flex w-max shrink-0 gap-3 pr-3 sm:gap-4 sm:pr-4"
              aria-hidden="true"
              data-benefit-clone-group
            >
              {benefitSignals.map((signal) => (
                <div key={signal.id} className="w-[calc(100vw-4.25rem)] shrink-0 sm:w-auto">
                  <BenefitSignal signal={signal} decorative />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
