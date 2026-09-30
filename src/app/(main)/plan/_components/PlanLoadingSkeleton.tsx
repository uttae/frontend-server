/** Reserve the day heading and place-card footprint during an initial query. */
export function PlanLoadingSkeleton({
  places = false,
  className = "",
}: Readonly<{
  places?: boolean;
  className?: string;
}>) {
  return (
    <div className={`space-y-4 py-4 ${className}`}>
      <output className="sr-only">{places ? "장소 목록 불러오는 중" : "일정 불러오는 중"}</output>
      <div aria-hidden="true" className="space-y-4 animate-pulse motion-reduce:animate-none">
        {!places && (
          <div className="flex items-center justify-between py-2">
            <div className="h-6 w-32 rounded bg-fill" />
            <div className="h-8 w-20 rounded-lg bg-fill" />
          </div>
        )}
        {[0, 1].map((row) => (
          <div key={row} className="flex min-h-24 items-center gap-4 rounded-xl border border-border-subtle p-4">
            <div className="size-14 shrink-0 rounded-lg bg-fill" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-2/3 rounded bg-fill" />
              <div className="h-3 w-1/2 rounded bg-fill" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
