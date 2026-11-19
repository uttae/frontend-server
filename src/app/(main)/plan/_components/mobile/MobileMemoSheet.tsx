"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldCount, FieldDescription, FieldError, FieldFooter, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateScheduleItem } from "@/hooks/useRooms";
import { SCHEDULE_ITEM_MEMO_MAX_LENGTH, scheduleItemMemoSchema } from "@/lib/plan/scheduleItemMemo";

type MobileMemoSheetProps = Readonly<{
  roomId: string;
  scheduleId: number;
  itemId: number;
  placeName: string;
  memo: string;
  onClose: () => void;
}>;

export function MobileMemoSheet({
  roomId,
  scheduleId,
  itemId,
  placeName,
  memo,
  onClose,
}: MobileMemoSheetProps) {
  const initial = memo.trim();
  const [editStartMemo, setEditStartMemo] = useState<string | null>(null);
  const hasRemoteChange = editStartMemo !== null && editStartMemo !== initial;
  const [isOverwriteConfirmOpen, setIsOverwriteConfirmOpen] = useState(false);
  const markEditStart = () => setEditStartMemo((prev) => prev ?? initial);
  const { mutateAsync: saveMemo, isPending: isSaving } = useUpdateScheduleItem();
  const { mutateAsync: deleteMemo, isPending: isDeleting } = useUpdateScheduleItem();
  const isWriting = isSaving || isDeleting;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formId = useId();
  const memoId = `${formId}-memo`;
  const descriptionId = `${formId}-memo-description`;
  const errorId = `${formId}-memo-error`;

  async function writeMemo(update: typeof saveMemo, next: string) {
    try {
      await update({ roomId, scheduleId, itemId, body: { memo: next } });
      toast.success(next ? "메모를 저장했어요." : "메모를 삭제했어요.");
      onClose();
    } catch {
      toast.error(next ? "메모를 저장하지 못했어요." : "메모를 삭제하지 못했어요.");
    }
  }

  const form = useForm({
    defaultValues: { memo: initial },
    onSubmit: ({ value }) => {
      if (hasRemoteChange) {
        setIsOverwriteConfirmOpen(true);
        return;
      }
      return writeMemo(saveMemo, scheduleItemMemoSchema.parse(value.memo));
    },
  });
  const hasMemo = initial.length > 0;
  const dirty = useStore(form.store, (state) => state.values.memo.trim() !== initial);

  return (
    <Drawer open onOpenChange={(open) => { if (!open) onClose(); }} closeDisabled={isWriting}>
      <DrawerContent
        closeLabel={hasMemo ? "메모 수정 닫기" : "메모 추가 닫기"}
        initialFocus={() => {
          const el = textareaRef.current;
          if (!el) return true;
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
          return el;
        }}
      >
        <DrawerHeader>
          <DrawerTitle>{hasMemo ? "메모 수정" : "메모 추가"}</DrawerTitle>
          <DrawerDescription>{placeName}</DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <form
            id={formId}
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (form.state.isSubmitting) return;
              void form.handleSubmit();
            }}
          >
            <form.Field name="memo" validators={{ onChange: scheduleItemMemoSchema }}>
              {(field) => {
                const error = field.state.meta.errors[0]?.message;
                return (
                  <Field>
                    <FieldLabel htmlFor={memoId}>메모</FieldLabel>
                    <Textarea
                      id={memoId}
                      ref={textareaRef}
                      value={field.state.value}
                      onChange={(event) => {
                        markEditStart();
                        field.handleChange(event.target.value);
                      }}
                      onBlur={() => {
                        markEditStart();
                        field.handleBlur();
                      }}
                      disabled={isWriting}
                      rows={5}
                      placeholder="메모를 입력하세요"
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `${descriptionId} ${errorId}` : descriptionId}
                      className="h-36"
                    />
                    <FieldDescription id={descriptionId}>
                      예약 정보나 함께 기억할 내용을 남겨보세요.
                    </FieldDescription>
                    <FieldFooter>
                      <FieldError id={errorId}>{error}</FieldError>
                      <FieldCount>
                        {field.state.value.length}/{SCHEDULE_ITEM_MEMO_MAX_LENGTH}
                      </FieldCount>
                    </FieldFooter>
                  </Field>
                );
              }}
            </form.Field>
          </form>
        </DrawerBody>
        <DrawerFooter>
          {hasMemo ? (
            <Button
              tone="critical"
              loading={isDeleting}
              loadingLabel="삭제 중"
              disabled={isSaving}
              onClick={() => void writeMemo(deleteMemo, "")}
            >
              삭제
            </Button>
          ) : null}
          <Button
            type="submit"
            form={formId}
            loading={isSaving}
            loadingLabel="저장 중"
            disabled={isDeleting || !dirty}
          >
            저장
          </Button>
        </DrawerFooter>
        {isOverwriteConfirmOpen ? (
          <ConfirmDialog
            title="다른 사람의 입력을 덮어씁니다!"
            description="다른 멤버가 메모를 수정했어요. 저장하면 그 내용 대신 지금 작성 중인 메모로 바뀝니다."
            isPending={isSaving}
            onConfirm={() => void writeMemo(saveMemo, scheduleItemMemoSchema.parse(form.state.values.memo))}
            onCancel={() => setIsOverwriteConfirmOpen(false)}
          />
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
