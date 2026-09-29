import {
  CalendarAddIcon,
  ChatIcon,
  ReactionStarIcon,
  SavedIcon,
} from "@/assets/icons";

type Props = Readonly<{
  name: string;
  category: string;
  rating: number | null;
  userRatingCount?: number | null;
  onAddBookmark?: () => void;
  onSendToChat?: () => void;
  sendToChatDisabled?: boolean;
  onAddToSchedule?: () => void;
}>;

const ICON_BUTTON_CLASS =
  "flex size-11 shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-50";

/** 모바일 바텀 시트용 장소 요약 — 이름·태그·평점, 북마크, 채팅/일정 버튼 */
export function PlaceSheetSummary({
  name,
  category,
  rating,
  userRatingCount,
  onAddBookmark,
  onSendToChat,
  sendToChatDisabled = false,
  onAddToSchedule,
}: Props) {
  return (
    <div>
      <div className="py-1 pl-5 pr-4">
        <h2 className="truncate text-title-m text-text">{name}</h2>
        <div className="flex items-end gap-5">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <p className="text-caption-l-regular text-text">{category}</p>
            <div className="flex items-center gap-[5px]">
              {/* Figma 인스턴스가 채운 별(stroke 없음)로 오버라이드되어 있어 fill로 칠하고 stroke는 끈다 */}
              <ReactionStarIcon
                size={16}
                className="fill-current text-[var(--orange-500)] [&_path]:stroke-none"
              />
              <span className="flex items-center gap-0.5 whitespace-nowrap">
                <span className="text-caption-l-emphasis text-text">
                  {rating != null ? rating.toFixed(1) : "-"}
                </span>
                {userRatingCount != null && (
                  <span className="text-caption-l-regular text-text-subtle">
                    ({userRatingCount.toLocaleString()}개)
                  </span>
                )}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onAddBookmark}
              disabled={!onAddBookmark}
              aria-label="북마크에 추가"
              className={ICON_BUTTON_CLASS}
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-primary-subtle">
                <SavedIcon size={20} className="text-primary" />
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-1 px-5 py-4">
        {onSendToChat && (
          <button
            type="button"
            onClick={onSendToChat}
            disabled={sendToChatDisabled}
            className="flex h-9 flex-1 items-center justify-center rounded-lg border border-border px-2.5 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChatIcon size={16} className="text-primary" />
            <span className="px-1.5 text-label-m-emphasis text-primary">채팅으로 보내기</span>
          </button>
        )}
        <button
          type="button"
          onClick={onAddToSchedule}
          disabled={!onAddToSchedule}
          className="flex h-9 flex-1 items-center justify-center rounded-lg bg-primary px-2.5 py-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CalendarAddIcon size={16} className="text-icon-inverse" />
          <span className="px-1.5 text-label-m-emphasis text-text-inverse">일정에 추가</span>
        </button>
      </div>
    </div>
  );
}
