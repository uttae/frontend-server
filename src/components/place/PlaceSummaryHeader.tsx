import { Star, Send, Calendar, Bookmark } from "lucide-react";

type Props = {
  name: string;
  category: string;
  reviewSummary?: string | null;
  rating: number | null;
  userRatingCount?: number | null;
  onSendToChat?: () => void;
  sendToChatDisabled?: boolean;
  onAddToSchedule?: () => void;
  addToScheduleDisabled?: boolean;
  onAddBookmark?: () => void;
  addBookmarkDisabled?: boolean;
};

export function PlaceSummaryHeader({
  name,
  category,
  reviewSummary,
  rating,
  userRatingCount,
  onSendToChat,
  sendToChatDisabled = false,
  onAddToSchedule,
  addToScheduleDisabled = false,
  onAddBookmark,
  addBookmarkDisabled = false,
}: Props) {
  return (
    <div className="border-b border-gray-border px-5 pb-5 pt-4">
      <div className="flex items-start gap-3">
        <h2 className="min-w-0 flex-1 leading-snug">
          <span className="block text-[22px] font-bold tracking-tight text-[#111827]">
            {name}
          </span>
          <span className="block text-[17px] font-normal text-[#6b7280]">
            {category}
          </span>
        </h2>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-base">
        <Star className="h-4 w-4 shrink-0 fill-[#FDC700] text-[#FDC700]" />
        <span className="font-semibold text-[#364153]">
          {rating != null ? rating.toFixed(1) : "-"}
        </span>
        {userRatingCount != null && (
          <span className="text-[#9ca3af]">
            리뷰 {userRatingCount.toLocaleString()}개
          </span>
        )}
      </div>

      {reviewSummary && (
        <p className="mt-2.5 text-[13px] leading-relaxed text-[#6b7280]">
          {reviewSummary}
        </p>
      )}

      {onSendToChat && (
        <button
          type="button"
          onClick={onSendToChat}
          disabled={sendToChatDisabled}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/35 bg-primary/5 py-3 text-[14px] font-semibold text-primary shadow-sm transition hover:bg-primary/10 active:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="채팅으로 보내기"
        >
          <Send className="h-4 w-4 shrink-0" strokeWidth={2} />
          채팅으로 보내기
        </button>
      )}

      <div className={`flex gap-2 ${onSendToChat ? "mt-2" : "mt-4"}`}>
        <button
          type="button"
          onClick={onAddToSchedule}
          disabled={addToScheduleDisabled || !onAddToSchedule}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-3 text-[14px] font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Calendar className="h-4 w-4" strokeWidth={2} />
          일정에 추가
        </button>
        <button
          type="button"
          onClick={onAddBookmark}
          disabled={addBookmarkDisabled || !onAddBookmark}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-3 text-[14px] font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Bookmark className="h-4 w-4" strokeWidth={2} />
          북마크에 추가
        </button>
      </div>
    </div>
  );
}
