/** 장소 상세 본문 로딩 스켈레톤 — `PlaceSummaryHeader`·탭·홈 탭 배치를 따른다 */
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-fill-strong ${className}`} />;
}

export function PlaceDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="장소 정보를 불러오는 중">
      {/* 이름·카테고리·평점·액션 버튼 */}
      <div className="border-b border-gray-border px-5 pb-5 pt-4">
        <Bar className="h-7 w-3/5" />
        <Bar className="mt-2 h-4 w-1/4" />
        <Bar className="mt-4 h-4 w-2/5" />
        <Bar className="mt-4 h-11 w-full rounded-lg" />
        <div className="mt-2 flex gap-2">
          <Bar className="h-11 flex-1 rounded-lg" />
          <Bar className="h-11 flex-1 rounded-lg" />
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-4 border-b border-gray-border px-5 py-3">
        <Bar className="h-4 flex-1" />
        <Bar className="h-4 flex-1" />
      </div>

      {/* 홈 탭 본문 */}
      <div className="space-y-3 px-5 py-4">
        <Bar className="h-4 w-4/5" />
        <Bar className="h-4 w-3/5" />
        <Bar className="h-4 w-2/3" />
        <Bar className="h-4 w-1/2" />
      </div>
    </div>
  );
}
