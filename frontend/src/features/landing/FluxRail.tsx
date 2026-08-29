function FluxMarker({ mobile = false }: { mobile?: boolean }) {
  return (
    <g data-flux-marker-mobile={mobile || undefined} data-flux-marker-desktop={!mobile || undefined}>
      <path d="M0 -6 L6 0 L0 6 L-6 0 Z" className="fill-surface-raised stroke-accent" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle r="1.8" className="fill-accent" />
    </g>
  );
}

export function FluxRail() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[6.25rem] h-20" data-flux-rail-field aria-hidden="true">
      <svg className="hidden size-full overflow-visible sm:block" viewBox="0 0 480 112" preserveAspectRatio="none" data-flux-rail="desktop">
        <path d="M22 38 H184 C230 38 235 66 280 66 H352 C389 66 394 92 426 92 C450 92 447 67 460 67" pathLength="1" vectorEffect="non-scaling-stroke" className="fill-none stroke-line-strong/75" strokeWidth="2" data-flux-rail-base />
        <path d="M22 38 H184" pathLength="1" vectorEffect="non-scaling-stroke" className="fill-none stroke-accent" strokeWidth="3" strokeLinecap="round" data-flux-rail-capture />
        <path d="M184 38 H214" pathLength="1" vectorEffect="non-scaling-stroke" className="fill-none stroke-accent-strong" strokeWidth="3" strokeLinecap="round" data-flux-rail-context />
        <path d="M214 38 C240 38 246 66 280 66 H352" pathLength="1" vectorEffect="non-scaling-stroke" className="fill-none stroke-accent" strokeWidth="3" strokeLinecap="round" data-flux-rail-progress />
        <path d="M352 66 C389 66 394 92 426 92" pathLength="1" vectorEffect="non-scaling-stroke" className="fill-none stroke-violet" strokeWidth="3" strokeLinecap="round" data-flux-rail-prepare />
        <path d="M426 92 C450 92 447 67 460 67" pathLength="1" vectorEffect="non-scaling-stroke" className="fill-none stroke-success" strokeWidth="3" strokeLinecap="round" data-flux-rail-act />
        <path d="M184 31 L191 38 L184 45 L177 38 Z" className="fill-surface-raised stroke-accent-strong" strokeWidth="2" vectorEffect="non-scaling-stroke" data-flux-context-node />
        <circle cx="352" cy="66" r="3.5" className="fill-surface-raised stroke-line-strong" strokeWidth="2" />
        <path d="M426 85 L433 92 L426 99 L419 92 Z" className="fill-surface-raised stroke-violet" strokeWidth="2" vectorEffect="non-scaling-stroke" data-flux-resolve-node />
        <circle cx="460" cy="67" r="4" className="fill-surface-raised stroke-success" strokeWidth="2" data-flux-act-node />
        <g transform="translate(42 38)"><FluxMarker /></g>
      </svg>

      <svg className="size-full overflow-visible sm:hidden" viewBox="0 0 280 112" preserveAspectRatio="none" data-flux-rail="mobile">
        <path d="M18 34 H102 C130 34 134 62 162 62 H204 C229 62 231 86 248 86 C263 86 257 64 266 64" pathLength="1" vectorEffect="non-scaling-stroke" className="fill-none stroke-line-strong/75" strokeWidth="2" data-flux-rail-base />
        <path d="M18 34 H102" pathLength="1" vectorEffect="non-scaling-stroke" className="fill-none stroke-accent" strokeWidth="3" strokeLinecap="round" data-flux-rail-capture />
        <path d="M102 34 H126" pathLength="1" vectorEffect="non-scaling-stroke" className="fill-none stroke-accent-strong" strokeWidth="3" strokeLinecap="round" data-flux-rail-context />
        <path d="M126 34 C140 34 143 62 162 62 H204" pathLength="1" vectorEffect="non-scaling-stroke" className="fill-none stroke-accent" strokeWidth="3" strokeLinecap="round" data-flux-rail-progress />
        <path d="M204 62 C229 62 231 86 248 86" pathLength="1" vectorEffect="non-scaling-stroke" className="fill-none stroke-violet" strokeWidth="3" strokeLinecap="round" data-flux-rail-prepare />
        <path d="M248 86 C263 86 257 64 266 64" pathLength="1" vectorEffect="non-scaling-stroke" className="fill-none stroke-success" strokeWidth="3" strokeLinecap="round" data-flux-rail-act />
        <path d="M102 28 L108 34 L102 40 L96 34 Z" className="fill-surface-raised stroke-accent-strong" strokeWidth="2" vectorEffect="non-scaling-stroke" data-flux-context-node />
        <circle cx="204" cy="62" r="3.5" className="fill-surface-raised stroke-line-strong" strokeWidth="2" />
        <path d="M248 80 L254 86 L248 92 L242 86 Z" className="fill-surface-raised stroke-violet" strokeWidth="2" vectorEffect="non-scaling-stroke" data-flux-resolve-node />
        <circle cx="266" cy="64" r="4" className="fill-surface-raised stroke-success" strokeWidth="2" data-flux-act-node />
        <g transform="translate(28 34)"><FluxMarker mobile /></g>
      </svg>
      <div className="absolute inset-x-5 top-[3.35rem] grid grid-cols-3 text-[0.5rem] font-bold uppercase tracking-[0.1em] text-ink-muted sm:inset-x-8" data-flux-journey-labels>
        <span>Context</span><span className="text-center">Interview</span><span className="text-right">Next move</span>
      </div>
    </div>
  );
}
