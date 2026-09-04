import { Check, Layers3, ShieldCheck, type LucideIcon } from "lucide-react";
import { LandingReveal } from "./LandingProductStory";

interface DemoTrustItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

const trustItems: DemoTrustItem[] = [
  {
    icon: ShieldCheck,
    title: "Isolated by design",
    description: "Every visitor receives a separate temporary workspace.",
  },
  {
    icon: Layers3,
    title: "Ready to explore",
    description: "Follow one coherent workflow across applications, interviews, notes, and analytics.",
  },
  {
    icon: Check,
    title: "Safe to experiment",
    description: "Edit, archive, restore, or reset without affecting anyone else.",
  },
];

export function DemoTrustStrip() {
  return (
    <LandingReveal>
      <section className="border-y border-line bg-surface dark:border-slate-800 dark:bg-slate-900/80" aria-label="Demo guarantees">
        <div className="mx-auto grid max-w-7xl gap-px bg-line dark:bg-slate-800 sm:grid-cols-3">
          {trustItems.map(({ icon: Icon, title, description }) => (
            <article key={title} className="min-w-0 bg-surface px-6 py-9 dark:bg-slate-900 lg:px-8" data-landing-clip-check>
              <Icon aria-hidden="true" className="size-5 text-brand-700" />
              <h2 className="mt-4 font-bold text-ink dark:text-white">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-muted dark:text-slate-300">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </LandingReveal>
  );
}
