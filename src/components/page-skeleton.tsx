import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly by each route group's loading.tsx while the page's server
// data loads, so navigation never looks frozen.
export function PageSkeleton() {
  return (
    <div className="page-shell py-[32px] flex flex-col gap-[20px]" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-[10px]">
        <Skeleton className="h-[28px] w-[260px]" />
        <Skeleton className="h-[14px] w-[420px] max-w-full" />
      </div>
      <div className="grid gap-[16px] sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[112px] rounded-[16px]" />
        ))}
      </div>
      <Skeleton className="h-[280px] rounded-[16px]" />
    </div>
  );
}
