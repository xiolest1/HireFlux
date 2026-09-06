/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The reduced-motion fallback is a native horizontal scroll region. */
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { IconButton } from "../../../components/ui/IconButton";
import { BenefitSignal } from "./BenefitSignal";
import { benefitSignals } from "./benefitsModel";
import { useBenefitsStream } from "./useBenefitsStream";

export function ProductBenefitsSection() {
  const stream = useBenefitsStream(benefitSignals.length);
  const reducedMotion = stream.mode === "static";
  const ambientPlaying = stream.mode === "ambient";
  const controlLocked = stream.isTransitioning || undefined;

  return (
    <section
      ref={stream.rootRef}
      className="mx-auto max-w-7xl min-w-0 px-4 pt-14 sm:px-6 sm:pt-20 lg:px-8"
      aria-labelledby="product-benefits-title"
      data-product-benefits
    >
      <div className="flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between" data-landing-clip-check>
        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700 sm:text-sm">Why HireFlux</p>
          <h2 id="product-benefits-title" className="mt-2.5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl dark:text-white">
            A clearer way through the search.
          </h2>
        </div>
        {!reducedMotion ? (
          <div className="flex shrink-0 gap-2" aria-label="Benefit stream controls" role="group">
            <IconButton
              label="Previous benefit"
              aria-controls="benefit-signals-viewport"
              aria-disabled={controlLocked}
              onClick={stream.previous}
              data-benefits-control="previous"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </IconButton>
            <IconButton
              label={ambientPlaying ? "Pause benefit stream" : "Play benefit stream"}
              aria-controls="benefit-signals-viewport"
              aria-disabled={controlLocked}
              onClick={ambientPlaying ? stream.pause : stream.play}
              data-benefits-control="play-pause"
            >
              {ambientPlaying ? <Pause aria-hidden="true" className="size-4" /> : <Play aria-hidden="true" className="size-4" />}
            </IconButton>
            <IconButton
              label="Next benefit"
              aria-controls="benefit-signals-viewport"
              aria-disabled={controlLocked}
              onClick={stream.next}
              data-benefits-control="next"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </IconButton>
          </div>
        ) : null}
      </div>
      <div
        ref={stream.viewportRef}
        id="benefit-signals-viewport"
        className={`hf-benefits-viewport -mx-4 mt-6 pb-2 ${reducedMotion ? "overflow-x-auto overscroll-x-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas" : "hf-benefits-edge-fade overflow-hidden"} sm:-mx-6 lg:-mx-8`}
        role="region"
        aria-label="Benefit signals"
        tabIndex={reducedMotion ? 0 : undefined}
        data-benefits-motion={stream.mode}
        data-benefits-viewport
      >
        <div
          ref={stream.trackRef}
          className="hf-benefits-track flex w-max pl-4 sm:pl-6 lg:pl-8"
          data-motion-state={stream.mode}
          data-passively-blocked={stream.passivelyBlocked}
          data-manual-signal={stream.currentIndex === null ? undefined : benefitSignals[stream.currentIndex].id}
          data-benefits-track
        >
          <ol
            ref={stream.realGroupRef}
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
