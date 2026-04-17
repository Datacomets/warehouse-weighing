import { clsx } from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-lg bg-surface-container-high",
        className
      )}
    />
  );
}

/** Card-shaped skeleton matching DocumentCard dimensions */
export function CardSkeleton() {
  return (
    <div className="card flex flex-col gap-2 py-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex gap-2 mt-1">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

/** Stat card skeleton matching the home page Stat component */
export function StatSkeleton() {
  return (
    <div className="card flex flex-col gap-1">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-8 w-12 mt-1" />
    </div>
  );
}

/** Step nav skeleton */
export function StepNavSkeleton() {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 -mx-4 px-4 sticky top-16 bg-background z-30 pb-2 pt-1">
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-24 rounded-full flex-shrink-0" />
      ))}
    </div>
  );
}
