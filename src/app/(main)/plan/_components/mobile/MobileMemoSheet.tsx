"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";
import { useUpdateScheduleItem } from "@/hooks/useRooms";

const MEMO_MAX_LENGTH = 2000;

type MobileMemoSheetProps = Readonly<{
  roomId: string;
  scheduleId: number;
  itemId: number;
  placeName: string;
  memo: string;
  onClose: () => void;
}>;

/** 장소 메모 추가·수정 시트 — 메모가 있으면 삭제 | 저장 두 버튼 */
export function MobileMemoSheet({
  roomId,
  scheduleId,
  itemId,
  placeName,
  memo,
  onClose,
}: MobileMemoSheetProps) {
  const initial = memo.trim();
  const [draft, setDraft] = useState(initial);
  const { mutateAsync, isPending } = useUpdateScheduleItem();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 시트가 열리면 바로 입력할 수 있게 포커스하고 커서를 기존 메모 끝에 둔다
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  const hasMemo = initial.length > 0;
  const dirty = draft.trim() !== initial;

  async function saveMemo(next: string) {
    try {
      await mutateAsync({ roomId, scheduleId, itemId, body: { memo: next } });
      toast.success(next ? "메모를 저장했어요." : "메모를 삭제했어요.");
      onClose();
    } catch {
      toast.error(next ? "메모를 저장하지 못했어요." : "메모를 삭제하지 못했어요.");
    }
  }

  return (
    <MobileBottomSheet
      open
      onClose={onClose}
      title={hasMemo ? "메모 수정" : "메모 추가"}
      subtitle={placeName}
      variant="form"
      closeDisabled={isPending}
    >
      <label className="flex flex-col gap-4">
        <span className="text-label-m-regular text-text">메모</span>
        <div className="h-36 rounded-[12px] bg-fill py-3 focus-within:ring-2 focus-within:ring-primary/30">
          <textarea
            ref={textareaRef}
            value={draft}
            maxLength={MEMO_MAX_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            disabled={isPending}
            rows={5}
            placeholder="메모를 입력하세요"
            className="block size-full resize-none bg-transparent px-3 text-body-s-regular text-text outline-none [scrollbar-color:var(--color-border-default)_transparent] [scrollbar-width:thin] placeholder:text-text-subtle"
          />
        </div>
      </label>
      <p className="text-caption-l-regular text-text-subtle">
        예약 정보나 함께 기억할 내용을 남겨보세요.
      </p>
      <div className="flex gap-2">
        {hasMemo ? (
          <button
            type="button"
            onClick={() => void saveMemo("")}
            disabled={isPending}
            className="min-h-12 flex-1 rounded-[12px] border border-border text-label-m-regular text-status-negative disabled:opacity-40"
          >
            삭제
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void saveMemo(draft.trim())}
          disabled={isPending || !dirty}
          className="min-h-12 flex-1 rounded-[12px] bg-primary text-label-m-regular text-fill-elevate disabled:opacity-40"
        >
          {isPending ? "저장 중…" : "저장"}
        </button>
      </div>
    </MobileBottomSheet>
  );
}
