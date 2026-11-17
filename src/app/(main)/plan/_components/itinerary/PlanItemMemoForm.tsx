"use client";

import { MemoIcon, TrashIcon } from "@/assets/icons";
import { useForm, useStore } from "@tanstack/react-form";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateScheduleItem } from "@/hooks/useRooms";
import { PLAN_PLACE_CARD_TW } from "@/lib/layout-tokens";
import { SCHEDULE_ITEM_MEMO_MAX_LENGTH, scheduleItemMemoSchema } from "@/lib/plan/scheduleItemMemo";
import { renderTextWithLinks } from "@/lib/text/renderTextWithLinks";

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
    // Figma Memo — 3줄까지는 그대로, 넘으면 3줄 높이에서 자르고 스크롤한다. 바깥 0.5px stroke는 크기에 들어가지 않는 ring
    <div className="flex w-full items-start gap-2 rounded-[12px] bg-fill-strong py-3 pl-5 pr-3 ring-[0.5px] ring-border">
      <div className="flex min-w-0 flex-1 items-start gap-1.5">
        <span className="flex h-5 shrink-0 items-center text-icon">
          <MemoIcon size={16} />
        </span>
        <p className="max-h-[3lh] min-w-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words text-body-s-regular text-text">
          {renderTextWithLinks(text, {
            linkClassName: MEMO_LINK_CLASS_NAME,
            onLinkClick: (e) => e.stopPropagation(),
          })}
        </p>
      </div>
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
          // 누르는 영역만 28px로 넓히고 줄 안에서는 Figma Delete 칸 20px만 차지한다
          className="-m-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-icon-subtle transition hover:bg-fill hover:text-icon disabled:cursor-not-allowed disabled:opacity-40"
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
  const [hasRemoteConflict, setHasRemoteConflict] = useState(false);
  const [overwriteDialogOpen, setOverwriteDialogOpen] = useState(false);
  const { mutateAsync, isPending } = useUpdateScheduleItem();
  const errorId = useId();

  async function commitSave(next: string) {
    try {
      await mutateAsync({ roomId, scheduleId, itemId, body: { memo: next } });
      setEditStartMemo(next);
      setHasRemoteConflict(false);
      setOverwriteDialogOpen(false);
      toast.success(next.length > 0 ? "메모를 저장했어요." : "메모를 삭제했어요.");
      onClose();
    } catch {
      toast.error("메모를 저장하지 못했어요.");
    }
  }

  // 연 순간 값으로 시작한다. 서버 메모를 다시 채우는 것은 아래 effect가 form.reset으로 한다
  const [defaultValues] = useState(() => ({ memo: incomingMemo }));
  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      if (hasRemoteConflict) {
        setOverwriteDialogOpen(true);
        return;
      }
      // value는 다듬기 전 값이라 스키마로 trim한 값을 보낸다
      await commitSave(scheduleItemMemoSchema.parse(value.memo));
    },
  });
  const draft = useStore(form.store, (state) => state.values.memo);

  /* eslint-disable react-hooks/set-state-in-effect -- 서버 메모 변경을 편집 draft와 충돌 상태에 동기화합니다. */
  useEffect(() => {
    if (!isLocallyDirty(draft, editStartMemo)) {
      // 고치지 않았으면 서버 새 값으로 다시 채운다. keepDefaultValues가 없으면 다음 렌더에 useForm이 연 순간 값으로 되돌린다
      if (draft !== incomingMemo) form.reset({ memo: incomingMemo }, { keepDefaultValues: true });
      setEditStartMemo(incomingMemo);
      setHasRemoteConflict(false);
      return;
    }

    if (normalizeMemoDraft(incomingMemo) !== normalizeMemoDraft(editStartMemo)) {
      setHasRemoteConflict(true);
    }
  }, [incomingMemo, draft, editStartMemo, form]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const dirty = isLocallyDirty(draft, editStartMemo);

  return (
    <>
      <div
        className={PLAN_PLACE_CARD_TW.editorModule}
        onMouseDown={stopCardActivation}
        onClick={stopCardActivation}
      >
        <div className={PLAN_PLACE_CARD_TW.editorSideLabelWrapper}>
          <MemoIcon />
        </div>

        <div className={PLAN_PLACE_CARD_TW.editorBody}>
          {/* 길이 제한은 입력 칸이 아니라 스키마가 쓰는 동안 본다(모바일 메모 시트와 같음) */}
          <form.Field name="memo" validators={{ onChange: scheduleItemMemoSchema }}>
            {(field) => {
              const error = field.state.meta.errors[0]?.message;
              return (
                <>
                  <Textarea
                    aria-label="일정 메모"
                    value={field.state.value}
                    placeholder="여기에 메모를 작성하세요"
                    disabled={isPending}
                    onMouseDown={stopCardActivation}
                    onClick={stopCardActivation}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    // 카드(article)의 select-none과 잡기·기본 커서를 물려받지 않게 글자 선택·글자 커서로 되돌린다
                    className="select-text cursor-text"
                  />
                  <FieldError id={errorId}>{error}</FieldError>
                </>
              );
            }}
          </form.Field>
          <div className={PLAN_PLACE_CARD_TW.editorFooterRow}>
            <span className="mr-auto text-caption-s-regular tabular-nums text-dark-gray/60">
              {draft.length}/{SCHEDULE_ITEM_MEMO_MAX_LENGTH}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                form.reset({ memo: incomingMemo }, { keepDefaultValues: true });
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
              onClick={() => void form.handleSubmit()}
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
          onConfirm={() => void commitSave(scheduleItemMemoSchema.parse(form.state.values.memo))}
          onCancel={() => setOverwriteDialogOpen(false)}
        />
      ) : null}
    </>
  );
}
