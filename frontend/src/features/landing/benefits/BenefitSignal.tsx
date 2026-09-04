import type {
  BenefitSignalContent,
  BenefitSignalTone,
  BenefitSignalWidth,
} from "./benefitsModel";

const widthClasses: Record<BenefitSignalWidth, string> = {
  small: "sm:w-[15rem]",
  medium: "sm:w-[18rem]",
  wide: "sm:w-[21rem]",
};

const stateToneClasses: Record<BenefitSignalTone, string> = {
  neutral: "border-line-strong bg-surface-muted text-ink-muted dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300",
  accent: "border-accent/25 bg-accent-soft/60 text-accent-strong",
  violet: "border-violet/25 bg-violet-soft/50 text-violet",
  success: "border-success/25 bg-success-soft/65 text-success",
  warning: "border-warning/25 bg-warning-soft/65 text-warning",
};

const stateDotClasses: Record<BenefitSignalTone, string> = {
  neutral: "bg-line-strong dark:bg-slate-500",
  accent: "bg-accent",
  violet: "bg-violet",
  success: "bg-success",
  warning: "bg-warning",
};

export function BenefitSignal({ signal }: { signal: BenefitSignalContent }) {
  const titleId = `benefit-signal-${signal.id}-title`;

  return (
    <article
      className={`flex h-[7.875rem] min-w-0 flex-col rounded-[1.15rem] border border-line bg-surface-raised p-3.5 dark:border-slate-800 dark:bg-slate-900/65 sm:p-4 ${widthClasses[signal.width]}`}
      aria-labelledby={titleId}
      data-benefit-signal={signal.id}
      data-benefit-width={signal.width}
    >
      {signal.stateTreatment === "badge" ? (
        <p
          className={`w-fit rounded-full border px-2 py-0.5 text-[0.6rem] font-black uppercase leading-3.5 tracking-[0.1em] ${stateToneClasses[signal.tone]}`}
          data-benefit-state
        >
          {signal.state}
        </p>
      ) : (
        <p
          className="flex items-center gap-2 text-[0.6rem] font-black uppercase leading-3.5 tracking-[0.11em] text-ink-muted dark:text-slate-300"
          data-benefit-state
        >
          <span className={`size-1.5 shrink-0 rounded-full ${stateDotClasses[signal.tone]}`} aria-hidden="true" />
          {signal.state}
        </p>
      )}
      <h3 id={titleId} className="mt-1.5 text-base font-black leading-5 tracking-[-0.018em] text-slate-950 dark:text-white sm:text-[1.05rem]">
        {signal.headline}
      </h3>
      <p className="mt-1.5 text-xs leading-4 text-slate-600 dark:text-slate-300">
        {signal.support}
      </p>
    </article>
  );
}
