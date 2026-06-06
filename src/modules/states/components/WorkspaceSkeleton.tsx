import { Skeleton } from "@/components/ui/skeleton";

export function WorkspaceSkeleton() {
  return (
    <main className="grid h-screen min-h-0 grid-cols-1 overflow-hidden bg-background text-foreground lg:grid-cols-[56px_300px_minmax(0,1fr)]">
      <div className="hidden border-r border-border bg-panel px-2 py-3 lg:block">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="mx-auto h-9 w-9" />
          ))}
        </div>
      </div>
      <aside className="hidden border-r border-border bg-panel px-3 py-4 lg:block">
        <Skeleton className="h-5 w-24" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[16px_minmax(0,1fr)] gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className={index % 3 === 0 ? "h-4 w-2/3" : "h-4 w-full"} />
            </div>
          ))}
        </div>
      </aside>
      <section className="flex min-h-0 flex-col bg-background">
        <div className="flex min-h-10 items-center gap-2 border-b border-border px-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-6 w-28" />
        </div>
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-8 py-8">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="mt-8 h-4 w-full" />
          <Skeleton className="mt-3 h-4 w-11/12" />
          <Skeleton className="mt-3 h-4 w-9/12" />
          <Skeleton className="mt-8 h-36 w-full" />
        </div>
      </section>
    </main>
  );
}

export function SettingsSkeleton() {
  return (
    <main className="min-h-screen bg-background px-6 py-6 text-foreground">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="space-y-2">
          <Skeleton className="h-8 w-32" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </aside>
        <section className="space-y-4">
          <Skeleton className="h-10 w-64" />
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </section>
      </div>
    </main>
  );
}
