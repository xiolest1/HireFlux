import { Button } from "../../components/ui/Button";
import { ErrorPanel } from "../../components/ui/Feedback";

export interface QuietCodaProps {
  actionLabel: string;
  error: unknown;
  isCreating: boolean;
  onAction: () => void;
}

export function QuietCoda({
  actionLabel,
  error,
  isCreating,
  onAction,
}: QuietCodaProps) {
  return (
    <section
      className="mx-auto max-w-[90rem] min-w-0 px-4 pb-20 sm:px-6 sm:pb-24 md:grid md:grid-cols-12 lg:px-8 lg:pb-32"
      aria-labelledby="quiet-coda-title"
      data-quiet-coda
    >
      <div
        className="max-w-3xl md:col-span-10 md:col-start-2 md:max-w-4xl lg:col-span-8 lg:col-start-3"
        data-landing-clip-check
        data-quiet-coda-layout
      >
        <div data-quiet-coda-beat="narrative">
          <h2
            id="quiet-coda-title"
            className="max-w-2xl text-2xl font-black tracking-tight text-ink sm:text-3xl md:max-w-3xl lg:text-4xl dark:text-white"
          >
            What happened should help you see what matters now.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-ink-muted dark:text-slate-300">
            When each opportunity keeps its context, you can return without
            rebuilding the story—and recognize whether the next move is yours.
          </p>
        </div>

        <div
          className="mt-8 flex flex-col items-start gap-3"
          data-quiet-coda-beat="action"
        >
          <Button
            variant="secondary"
            className="w-48 max-w-full"
            aria-busy={isCreating || undefined}
            disabled={isCreating}
            onClick={onAction}
            data-quiet-coda-action
          >
            {actionLabel}
          </Button>
          <p className="max-w-xl text-sm leading-6 text-ink-muted dark:text-slate-400">
            No sign-up. The temporary demo starts with fictional data.
          </p>
          {error ? (
            <div className="mt-2 w-full max-w-xl" data-quiet-coda-error>
              <ErrorPanel
                compact
                animate={false}
                headingLevel={3}
                title="Demo workspace could not be prepared"
                error={error}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
