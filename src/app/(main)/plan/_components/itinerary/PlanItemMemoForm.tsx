"use client";

import { TrashIcon } from "@/assets/icons";
import { MemoIcon } from "@/components/icons";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateScheduleItem } from "@/hooks/useRooms";
import { PLAN_PLACE_CARD_TW } from "@/lib/layout-tokens";
import { renderTextWithLinks } from "@/lib/text/renderTextWithLinks";
import { cn } from "@/lib/utils";

const SCHEDULE_ITEM_MEMO_MAX_LENGTH = 2000;

const MEMO_LINK_CLASS_NAME =
  "break-all text-primary-strong underline underline-offset-2 hover:opacity-80";

type PlanItemMemoEditorProps = {
  roomId: string;
  scheduleId: number;
  itemId: number;
  memo?: string;
  onClose: () => void;
};

function stopCardActivation(e: React.SyntheticEvent) {
  e.stopPropagation();
}

function normalizeMemoDraft(value: string): string {
  return value.trim();
}

function isLocallyDirty(draft: string, editStartMemo: string): boolean {
  return draft !== editStartMemo;
}

export function PlanItemMemoReadOnly({
  memo,
  onDelete,
  isDeleting = false,
}: {
  memo: string;
  onDelete?: () => void;
  isDeleting?: boolean;
}) {
  const text = memo.trim();
  if (!text.length) return null;

  return (
    // 아이콘·간격은 카드 액션 버튼(16px 아이콘, 6px 간격)과 맞추고, 글자 시작·높이·휴지통 위치는 디자인 값에 맞춘다
    <div className={cn(PLAN_PLACE_CARD_TW.editorModule, "gap-1.5 py-[13px] pl-[19px]")}>
      <div className={cn(PLAN_PLACE_CARD_TW.editorSideLabelWrapper, "pt-1")}>
        <MemoIcon className="h-4 w-4" />
      </div>
      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-body-s-regular mobile:text-body-xs-regular leading-relaxed text-gray-900">
        {renderTextWithLinks(text, {
          linkClassName: MEMO_LINK_CLASS_NAME,
          onLinkClick: (e) => e.stopPropagation(),
        })}
      </p>
      {onDelete ? (
        <button
          type="button"
          aria-label="메모 삭제"
          disabled={isDeleting}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="-mr-[3px] shrink-0 cursor-pointer self-start rounded-md p-1 text-dark-gray transition hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <TrashIcon size={16} />
        </button>
      ) : null}
    </div>
  );
}

export function PlanItemMemoEditor({
  roomId,
  scheduleId,
  itemId,
  memo,
  onClose,
}: PlanItemMemoEditorProps) {
  const incomingMemo = memo ?? "";
  const [editStartMemo, setEditStartMemo] = useState(incomingMemo);
  const [draft, setDraft] = useState(incomingMemo);
  const [hasRemoteConflict, setHasRemoteConflict] = useState(false);
  const [overwriteDialogOpen, setOverwriteDialogOpen] = useState(false);
  const { mutateAsync, isPending } = useUpdateScheduleItem();

  /* eslint-disable react-hooks/set-state-in-effect -- 서버 메모 변경을 편집 draft와 충돌 상태에 동기화합니다. */
  useEffect(() => {
    if (!isLocallyDirty(draft, editStartMemo)) {
      setDraft(incomingMemo);
      setEditStartMemo(incomingMemo);
      setHasRemoteConflict(false);
      return;
    }

    if (normalizeMemoDraft(incomingMemo) !== normalizeMemoDraft(editStartMemo)) {
      setHasRemoteConflict(true);
    }
  }, [incomingMemo, draft, editStartMemo]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const dirty = isLocallyDirty(draft, editStartMemo);

  const commitSave = useCallback(async () => {
    const next = normalizeMemoDraft(draft);
    if (next.length > SCHEDULE_ITEM_MEMO_MAX_LENGTH) {
      toast.error(`메모는 ${SCHEDULE_ITEM_MEMO_MAX_LENGTH}자 이하여야 해요.`);
      return;
    }
    try {
      await mutateAsync({
        roomId,
        scheduleId,
        itemId,
        body: { memo: next.length > 0 ? next : "" },
      });
      setEditStartMemo(next);
      setHasRemoteConflict(false);
      setOverwriteDialogOpen(false);
      toast.success(next.length > 0 ? "메모를 저장했어요." : "메모를 삭제했어요.");
      onClose();
    } catch {
      toast.error("메모를 저장하지 못했어요.");
    }
  }, [draft, itemId, mutateAsync, onClose, roomId, scheduleId]);

  async function handleSave() {
    const next = normalizeMemoDraft(draft);
    if (next.length > SCHEDULE_ITEM_MEMO_MAX_LENGTH) {
      toast.error(`메모는 ${SCHEDULE_ITEM_MEMO_MAX_LENGTH}자 이하여야 해요.`);
      return;
    }
    if (hasRemoteConflict) {
      setOverwriteDialogOpen(true);
      return;
    }
    await commitSave();
  }

  return (
    <>
      <div
        className={PLAN_PLACE_CARD_TW.editorModule}
        onMouseDown={stopCardActivation}
        onClick={stopCardActivation}
      >
        <div className={PLAN_PLACE_CARD_TW.editorSideLabelWrapper}>
          <MemoIcon className="h-6 w-6" />
        </div>

        <div className={PLAN_PLACE_CARD_TW.editorBody}>
          <Textarea
            aria-label="일정 메모"
            value={draft}
            maxLength={SCHEDULE_ITEM_MEMO_MAX_LENGTH}
            placeholder="여기에 메모를 작성하세요"
            disabled={isPending}
            onMouseDown={stopCardActivation}
            onClick={stopCardActivation}
            onChange={(e) => setDraft(e.target.value)}
            // 카드(article)의 select-none과 잡기·기본 커서를 물려받지 않게 글자 선택·글자 커서로 되돌린다
            className="select-text cursor-text"
          />
          <div className={PLAN_PLACE_CARD_TW.editorFooterRow}>
            <span className="mr-auto text-caption-s-regular tabular-nums text-dark-gray/60">
              {draft.length}/{SCHEDULE_ITEM_MEMO_MAX_LENGTH}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(incomingMemo);
                setEditStartMemo(normalizeMemoDraft(incomingMemo));
                setHasRemoteConflict(false);
                onClose();
              }}
              disabled={isPending}
            >
              취소
            </Button>
            <Button
              tone="brand"
              size="sm"
              onClick={() => void handleSave()}
              disabled={!dirty}
              loading={isPending}
              loadingLabel="저장 중"
            >
              저장
            </Button>
          </div>
        </div>
      </div>

      {overwriteDialogOpen ? (
        <ConfirmDialog
          title="다른 사람의 입력을 덮어씁니다!"
          description="다른 멤버가 메모를 수정했어요. 저장하면 그 내용 대신 지금 작성 중인 메모로 바뀝니다."
          isPending={isPending}
          onConfirm={() => void commitSave()}
          onCancel={() => setOverwriteDialogOpen(false)}
        />
      ) : null}
    </>
  );
}
