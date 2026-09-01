import { CircleCheckBig } from "lucide-react";

export function FluxRail() {
  return (
    <div
      className="relative h-16 sm:h-[4.5rem]"
      data-flux-connection
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 size-full overflow-visible"
        viewBox="0 0 480 72"
        preserveAspectRatio="none"
        data-flux-rail="connection"
      >
        <path
          d="M42 13 C164 13 166 58 284 58 H438"
          pathLength="1"
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-line-strong/70"
          strokeWidth="2"
          strokeLinecap="round"
          data-flux-connection-base
        />
        <path
          d="M42 13 C164 13 166 58 284 58 H438"
          pathLength="1"
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-accent"
          strokeWidth="2.5"
          strokeLinecap="round"
          data-flux-connection-line
        />
        <path
          d="M438 52 L444 58 L438 64 L432 58 Z"
          className="fill-surface-raised stroke-accent"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          data-flux-connection-marker
        />
      </svg>
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface-raised px-2.5 py-1.5 text-[0.58rem] font-bold text-ink-muted shadow-sm sm:text-[0.62rem]"
        data-flux-provenance
      >
        <CircleCheckBig className="size-3.5 shrink-0 text-success" />
        Interview complete · Preparation retained
      </div>
    </div>
  );
}
