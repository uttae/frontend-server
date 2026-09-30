export function BookmarkListSkeleton() {
  return (
    <div className="space-y-3 py-5">
      <output className="sr-only">북마크 불러오는 중</output>
      {[0, 1, 2].map((row) => (
        <div key={row} aria-hidden="true" className="h-16 animate-pulse rounded-xl bg-fill-strong motion-reduce:animate-none" />
      ))}
    </div>
  );
}
