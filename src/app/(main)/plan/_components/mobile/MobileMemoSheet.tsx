"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useId, useRef } from "react";
import { toast } from "sonner";

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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateScheduleItem } from "@/hooks/useRooms";

const MEMO_MAX_LENGTH = 2000;

// 입력은 maxLength로 막히지만 저장 전에 칸에서 한 번 더 확인한다. 문구는 PC 메모 편집(PlanItemMemoForm)과 같다
function memoLengthError(memo: string) {
  return memo.trim().length > MEMO_MAX_LENGTH ? `메모는 ${MEMO_MAX_LENGTH}자 이하여야 해요.` : undefined;
}

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
  // 저장과 삭제는 같은 API지만 진행 표시를 누른 버튼에만 두려고 따로 꺼낸다
  const { mutateAsync: saveMemo, isPending: isSaving } = useUpdateScheduleItem();
  const { mutateAsync: deleteMemo, isPending: isDeleting } = useUpdateScheduleItem();
  // 저장·삭제는 서로 배타적이라 닫기·입력 비활성에만 합쳐 쓴다
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
    onSubmit: ({ value }) => writeMemo(saveMemo, value.memo.trim()),
  });
  const hasMemo = initial.length > 0;
  // TanStack isDirty는 한 번 바뀌면 남아서, 되돌리면 다시 꺼지는 지금 기준(앞뒤 공백 무시 비교)을 그대로 쓴다
  const dirty = useStore(form.store, (state) => state.values.memo.trim() !== initial);

  return (
    <Drawer open onOpenChange={(open) => { if (!open) onClose(); }} closeDisabled={isWriting}>
      <DrawerContent
        closeLabel={hasMemo ? "메모 수정 닫기" : "메모 추가 닫기"}
        // 열자마자 입력할 수 있게 커서를 기존 메모 끝에 둔다. Base UI는 다음 프레임에 포커스해서 iOS가 키보드를 띄우지 않을 수 있어,
        // 지금 시트처럼 여는 흐름 안에서 바로 포커스하고 같은 요소를 돌려준다
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
            <form.Field name="memo" validators={{ onSubmit: ({ value }) => memoLengthError(value) }}>
              {(field) => {
                const error = field.state.meta.errors[0];
                return (
                  <Field>
                    <FieldLabel htmlFor={memoId}>메모</FieldLabel>
                    <Textarea
                      id={memoId}
                      ref={textareaRef}
                      value={field.state.value}
                      maxLength={MEMO_MAX_LENGTH}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
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
                    <FieldError id={errorId}>{error}</FieldError>
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
      </DrawerContent>
    </Drawer>
  );
}
