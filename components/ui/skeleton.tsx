import { cn } from "@/lib/utils"

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-xl bg-muted", className)} {...props} />
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3 animate-pulse">
      <div className="flex justify-between gap-2">
        <div className="h-5 w-16 rounded-full bg-muted" />
        <div className="h-5 w-20 rounded-full bg-muted" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3">
        <div className="space-y-1.5">
          <div className="h-2 w-10 rounded bg-muted" />
          <div className="h-4 w-12 rounded bg-muted" />
        </div>
        <div className="space-y-1.5 ml-auto">
          <div className="h-2 w-16 rounded bg-muted" />
          <div className="h-4 w-10 rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}

export function SearchSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}
