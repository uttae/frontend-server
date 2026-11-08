import { Skeleton } from "@/components/ui/skeleton";

export function BookmarkListSkeleton() {
  return (
    <div className="space-y-3 py-5">
      <output className="sr-only">북마크 불러오는 중</output>
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}
