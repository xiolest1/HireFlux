import { PanelSkeleton, Skeleton } from "../../components/ui/Skeleton";

function LoadingAnnouncement({ label }: { label: string }) {
  return (
    <span
      className="sr-only"
      role="status"
      aria-label={label}
      aria-live="polite"
    >
      {label}
    </span>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-panel" aria-hidden="true">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton rounded="full" className="h-7 w-20" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-4">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-10 w-24" rounded="lg" />
      </div>
    </div>
  );
}

export function ApplicationListSkeleton() {
  return (
    <div>
      <LoadingAnnouncement label="Loading applications…" />
      <div className="mb-4 flex items-center justify-between" aria-hidden="true">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="hidden h-10 w-44 md:block" rounded="lg" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

export function ApplicationDetailSkeleton() {
  return (
    <div>
      <LoadingAnnouncement label="Loading application…" />
      <Skeleton className="h-11 w-40" rounded="lg" />
      <div className="mt-4 rounded-3xl border border-line bg-surface p-5 shadow-panel sm:p-7" aria-hidden="true">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton rounded="full" className="h-7 w-20" />
            </div>
            <Skeleton className="h-9 w-4/5 max-w-lg" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-11 w-32" rounded="lg" />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" rounded="lg" />
          ))}
        </div>
      </div>
      <Skeleton className="mt-6 h-12 w-full" rounded="lg" />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <PanelSkeleton rows={7} />
        <PanelSkeleton rows={4} />
      </div>
    </div>
  );
}

export function ApplicationFormSkeleton({
  label = "Preparing application form…",
}: {
  label?: string;
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <LoadingAnnouncement label={label} />
      <div className="space-y-3" aria-hidden="true">
        <Skeleton className="h-11 w-40" rounded="lg" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-3/5" />
        <Skeleton className="h-4 w-4/5 max-w-xl" />
      </div>
      <div className="mt-8 space-y-6">
        <PanelSkeleton rows={7} />
        <Skeleton className="h-20 w-full" rounded="lg" />
        <div className="flex justify-end gap-3" aria-hidden="true">
          <Skeleton className="h-11 w-24" rounded="lg" />
          <Skeleton className="h-11 w-36" rounded="lg" />
        </div>
      </div>
    </div>
  );
}

export function ResourcePanelSkeleton({ label }: { label: string }) {
  return (
    <div className="mt-5">
      <LoadingAnnouncement label={label} />
      <div className="space-y-3" aria-hidden="true">
        <Skeleton className="h-20 w-full" rounded="lg" />
        <Skeleton className="h-20 w-full" rounded="lg" />
      </div>
    </div>
  );
}
