/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Native horizontal overflow must remain keyboard-scrollable. */
import { BenefitSignal } from "./BenefitSignal";
import { benefitSignals } from "./benefitsModel";

export function ProductBenefitsSection() {
  return (
    <section
      className="mx-auto max-w-7xl min-w-0 px-4 pt-14 sm:px-6 sm:pt-20 lg:px-8"
      aria-labelledby="product-benefits-title"
      data-product-benefits
    >
      <div className="max-w-xl" data-landing-clip-check>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700 sm:text-sm">Why HireFlux</p>
        <h2 id="product-benefits-title" className="mt-2.5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl dark:text-white">
          A clearer way through the search.
        </h2>
      </div>
      <div
        className="hf-benefits-viewport -mx-4 mt-6 overflow-x-auto overscroll-x-contain pb-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas sm:-mx-6 lg:-mx-8"
        role="region"
        aria-label="Benefit signals"
        tabIndex={0}
        data-benefits-viewport
      >
        <ol
          className="flex w-max snap-x snap-proximity gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8"
          data-benefits-track
        >
          {benefitSignals.map((signal) => (
            <li
              key={signal.id}
              className="w-[calc(100vw-4.25rem)] shrink-0 snap-start sm:w-auto"
            >
              <BenefitSignal signal={signal} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
