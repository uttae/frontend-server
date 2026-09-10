"use client";

import { Trash2 } from "lucide-react";

import { MemoIcon } from "@/components/icons";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

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

function MemoOverwriteConfirmDialog({
  open,
  isPending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="memo-overwrite-dialog-title"
        aria-describedby="memo-overwrite-dialog-desc"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-gray-border bg-white p-5 shadow-lg"
      >
        <h2 id="memo-overwrite-dialog-title" className="text-base font-semibold text-gray-900">
          다른 사람의 입력을 덮어씁니다!
        </h2>
        <p id="memo-overwrite-dialog-desc" className="mt-2 text-sm leading-relaxed text-dark-gray">
          다른 멤버가 메모를 수정했어요. 저장하면 그 내용 대신 지금 작성 중인 메모로 바뀝니다.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={onCancel}
            className="cursor-pointer rounded-md border border-gray-border px-3 py-1.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "저장 중…" : "확인"}
          </button>
        </div>
      </div>
    </div>
  );
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
    <div className={PLAN_PLACE_CARD_TW.editorModule}>
      <div className={PLAN_PLACE_CARD_TW.editorSideLabelWrapper}>
        <MemoIcon className="h-6 w-6" />
      </div>
      <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-900">
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
          className="shrink-0 cursor-pointer self-start rounded-md p-1 text-dark-gray transition hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
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
          <textarea
            aria-label="일정 메모"
            value={draft}
            maxLength={SCHEDULE_ITEM_MEMO_MAX_LENGTH}
            rows={4}
            placeholder="여기에 메모를 작성하세요"
            disabled={isPending}
            onMouseDown={stopCardActivation}
            onClick={stopCardActivation}
            onChange={(e) => setDraft(e.target.value)}
            className={cn(PLAN_PLACE_CARD_TW.memoTextarea, "select-text cursor-text")}
          />
          <div className={PLAN_PLACE_CARD_TW.editorFooterRow}>
            <span className="mr-auto text-[11px] tabular-nums text-dark-gray/60">
              {draft.length}/{SCHEDULE_ITEM_MEMO_MAX_LENGTH}
            </span>
            <button
              type="button"
              onClick={() => {
                setDraft(incomingMemo);
                setEditStartMemo(normalizeMemoDraft(incomingMemo));
                setHasRemoteConflict(false);
                onClose();
              }}
              disabled={isPending}
              className={cn(
                "cursor-pointer border border-gray-border bg-white text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40",
                PLAN_PLACE_CARD_TW.timeSaveButtonCompact
              )}
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isPending || !dirty}
              className={cn(
                "cursor-pointer bg-primary text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40",
                PLAN_PLACE_CARD_TW.timeSaveButtonCompact
              )}
            >
              {isPending ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      </div>

      <MemoOverwriteConfirmDialog
        open={overwriteDialogOpen}
        isPending={isPending}
        onCancel={() => setOverwriteDialogOpen(false)}
        onConfirm={() => void commitSave()}
      />
    </>
  );
}
