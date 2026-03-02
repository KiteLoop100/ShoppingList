"use client";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} />;
}

export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-6 w-8 shrink-0" />
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }, (_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-aldi-muted-light bg-white shadow-sm">
      <div className="p-3 pb-2 space-y-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-40 w-full rounded-none" />
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}
