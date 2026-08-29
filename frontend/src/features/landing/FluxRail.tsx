export function FluxRail() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[6.9rem] h-20 sm:top-[7.15rem]" aria-hidden="true">
      <svg
        className="hidden size-full overflow-visible sm:block"
        viewBox="0 0 480 112"
        preserveAspectRatio="none"
        data-flux-rail="desktop"
      >
        <path
          d="M22 45 H210 C244 45 248 72 280 72 H458"
          pathLength="1"
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-line"
          strokeWidth="2"
          data-flux-rail-base
        />
        <path
          d="M22 45 H184"
          pathLength="1"
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-accent"
          strokeWidth="3"
          strokeLinecap="round"
          data-flux-rail-capture
        />
        <path
          d="M184 45 H210 C244 45 248 72 280 72 H352"
          pathLength="1"
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-accent"
          strokeWidth="3"
          strokeLinecap="round"
          data-flux-rail-progress
        />
        <path
          d="M352 72 C389 72 394 96 426 96 H458"
          pathLength="1"
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-violet"
          strokeWidth="3"
          strokeLinecap="round"
          data-flux-rail-prepare
        />
        <circle cx="42" cy="45" r="5" className="fill-accent stroke-surface-raised" strokeWidth="3" data-flux-marker-desktop />
        <circle cx="184" cy="45" r="3.5" className="fill-surface-raised stroke-line-strong" strokeWidth="2" />
        <circle cx="352" cy="72" r="3.5" className="fill-surface-raised stroke-line-strong" strokeWidth="2" />
        <circle cx="458" cy="96" r="3.5" className="fill-surface-raised stroke-line-strong" strokeWidth="2" />
      </svg>

      <svg
        className="size-full overflow-visible sm:hidden"
        viewBox="0 0 280 112"
        preserveAspectRatio="none"
        data-flux-rail="mobile"
      >
        <path
          d="M18 38 H112 C137 38 137 67 162 67 H214 C236 67 236 92 262 92"
          pathLength="1"
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-line"
          strokeWidth="2"
          data-flux-rail-base
        />
        <path
          d="M18 38 H102"
          pathLength="1"
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-accent"
          strokeWidth="3"
          strokeLinecap="round"
          data-flux-rail-capture
        />
        <path
          d="M102 38 H112 C137 38 137 67 162 67 H190"
          pathLength="1"
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-accent"
          strokeWidth="3"
          strokeLinecap="round"
          data-flux-rail-progress
        />
        <path
          d="M190 67 H214 C236 67 236 92 262 92"
          pathLength="1"
          vectorEffect="non-scaling-stroke"
          className="fill-none stroke-violet"
          strokeWidth="3"
          strokeLinecap="round"
          data-flux-rail-prepare
        />
        <circle cx="28" cy="38" r="5" className="fill-accent stroke-surface-raised" strokeWidth="3" data-flux-marker-mobile />
        <circle cx="102" cy="38" r="3.5" className="fill-surface-raised stroke-line-strong" strokeWidth="2" />
        <circle cx="190" cy="67" r="3.5" className="fill-surface-raised stroke-line-strong" strokeWidth="2" />
        <circle cx="262" cy="92" r="3.5" className="fill-surface-raised stroke-line-strong" strokeWidth="2" />
      </svg>
    </div>
  );
}
