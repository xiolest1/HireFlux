import type { HTMLAttributes, ReactNode } from "react";

export type WorkspaceWidth = "narrow" | "standard" | "wide" | "data";

const widthClasses: Record<WorkspaceWidth, string> = {
  narrow: "max-w-4xl",
  standard: "max-w-6xl",
  wide: "max-w-7xl",
  data: "max-w-[92rem]",
};

export function WorkspaceFrame({ width = "standard", className = "", ...props }: HTMLAttributes<HTMLDivElement> & { width?: WorkspaceWidth }) {
  return <div className={`mx-auto w-full ${widthClasses[width]} ${className}`} {...props} />;
}

export function WorkspaceIntro({ title, lead, context, actions, className = "" }: { title: ReactNode; lead: ReactNode; context?: ReactNode; actions?: ReactNode; className?: string }) {
  return <header className={`grid gap-6 border-b border-line pb-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end ${className}`}>
    <div className="min-w-0"><h1 className="font-display text-3xl font-bold tracking-[-0.025em] text-ink sm:text-4xl lg:text-[2.75rem] lg:leading-[1.05]">{title}</h1><p className="mt-3 max-w-3xl text-lg font-semibold leading-7 text-ink sm:text-xl">{lead}</p>{context ? <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">{context}</p> : null}</div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </header>;
}

export function NarrativeSection({ title, description, children, className = "", id }: { title: ReactNode; description?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  const headingId = id ? `${id}-title` : undefined;
  return <section id={id} aria-labelledby={headingId} className={`py-8 sm:py-10 ${className}`}><div className="mb-6 max-w-3xl"><h2 id={headingId} className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2>{description ? <p className="mt-2 text-sm leading-6 text-ink-muted sm:text-base">{description}</p> : null}</div>{children}</section>;
}

export function TonalChapter({ children, tone = "neutral", className = "", ...props }: HTMLAttributes<HTMLElement> & { tone?: "neutral" | "brand" | "quiet" }) {
  const tones = { neutral: "bg-surface-muted/60", brand: "bg-accent-soft/65", quiet: "bg-surface-raised/65" };
  return <section className={`rounded-[2rem] ${tones[tone]} ${className}`} {...props}>{children}</section>;
}

export function ContextRail({ children, className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <aside className={`border-l-2 border-line pl-5 sm:pl-7 ${className}`} {...props}>{children}</aside>;
}
