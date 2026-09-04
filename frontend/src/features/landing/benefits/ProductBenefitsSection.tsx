import { BenefitPanel } from "./BenefitPanel";
import { productBenefits } from "./benefitsModel";

export function ProductBenefitsSection() {
  return (
    <section className="mx-auto max-w-7xl min-w-0 px-4 pt-16 sm:px-6 sm:pt-24 lg:px-8" aria-labelledby="product-benefits-title" data-product-benefits>
      <div className="max-w-2xl" data-landing-clip-check>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-700">Why HireFlux</p>
        <h2 id="product-benefits-title" className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl dark:text-white">More than tracking applications.</h2>
      </div>
      <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:gap-6">
        {productBenefits.map((benefit) => (
          <li key={benefit.id} className="min-w-0">
            <BenefitPanel benefit={benefit} />
          </li>
        ))}
      </ol>
    </section>
  );
}
