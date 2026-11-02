"use client";

import { useForm } from "@tanstack/react-form";
import { useId, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldHeader, FieldLabel, FieldSuffix } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { BookmarkFolder } from "@/types/bookmark";
import { UNTITLED_BOOKMARK_CATEGORY_LABEL } from "@/lib/bookmark-untitled-category-name";

const TITLE_MAX_LENGTH = 50;

const COLOR_PRESETS = [
  "#EAB308",
  "#14B8A6",
  "#F12D33",
  "#3B82F6",
  "#A855F7",
  "#EC4899",
  "#22C55E",
  "#F97316",
] as const;

type Mode = "create" | "edit";

function initialTitle(mode: Mode, initialFolder: BookmarkFolder | null) {
  if (mode === "edit" && initialFolder) {
    return initialFolder.title.slice(0, TITLE_MAX_LENGTH);
  }
  return "";
}

function initialColor(mode: Mode, initialFolder: BookmarkFolder | null): string {
  if (mode === "edit" && initialFolder) return initialFolder.color;
  return COLOR_PRESETS[0];
}

// 빈 제목은 허용한다(저장하는 쪽이 "제목 없는 북마크 N"을 고른다). maxLength가 있어도 한글 조합 중에는 한 글자 넘게 들어갈 수 있어 제출 때 길이를 다시 본다
function titleError(title: string) {
  return title.length > TITLE_MAX_LENGTH ? `제목은 ${TITLE_MAX_LENGTH}자까지 쓸 수 있어요.` : undefined;
}

export function AddBookmarkModal({
  mode,
  initialFolder,
  busy = false,
  onClose,
  onSave,
  /** 비어 있을 때 실제로 쓰이는 이름(다음 번호 반영). 없으면 기본 라벨만 표시 */
  untitledNameHint,
  /** 서버/저장 오류 시 인라인 표시 (토스트 대신) */
  formError = null,
  /** 닫힌 뒤 포커스를 돌려줄 곳. 메뉴 항목에서 열면 사라진 항목 대신 메뉴 버튼을 준다 */
  finalFocus,
}: {
  mode: Mode;
  initialFolder: BookmarkFolder | null;
  busy?: boolean;
  onClose: () => void;
  onSave: (payload: { title: string; color: string }) => void;
  untitledNameHint?: string;
  formError?: string | null;
  finalFocus?: ComponentProps<typeof DialogContent>["finalFocus"];
}) {
  const formId = useId();
  // 저장 요청(mutation)은 부모가 갖는다. 진행·실패는 부모의 busy·formError로 받는다
  const form = useForm({
    defaultValues: {
      title: initialTitle(mode, initialFolder),
      color: initialColor(mode, initialFolder),
    },
    onSubmit: ({ value }) => {
      onSave({ title: value.title.trim(), color: value.color });
    },
  });

  return (
    <Dialog
      open
      closeDisabled={busy}
      // 열린 채 마운트되므로 닫기 요청(open=false)만 온다. 저장 중에는 Esc·딤·취소를 막는다
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="sm" showCloseButton={false} finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "북마크 편집" : "새 북마크 생성"}</DialogTitle>
        </DialogHeader>
        {formError ? (
          <p className="text-body-m-regular mobile:text-body-s-regular text-primary" role="alert">
            {formError}
          </p>
        ) : null}

        <form
          id={formId}
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            // 라이브러리는 연타를 막지 않는다. busy는 부모 mutation의 isPending
            if (busy || form.state.isSubmitting) return;
            void form.handleSubmit();
          }}
        >
          <form.Field name="title" validators={{ onSubmit: ({ value }) => titleError(value) }}>
            {(field) => {
              const error = field.state.meta.errors[0];
              const counterId = `${formId}-title-counter`;
              const errorId = `${formId}-title-error`;
              return (
                <Field>
                  <FieldHeader>
                    <FieldLabel htmlFor={`${formId}-title`}>제목</FieldLabel>
                    <FieldSuffix id={counterId} aria-live="polite">
                      {field.state.value.length}/{TITLE_MAX_LENGTH}
                    </FieldSuffix>
                  </FieldHeader>
                  <Input
                    id={`${formId}-title`}
                    type="text"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    maxLength={TITLE_MAX_LENGTH}
                    placeholder={untitledNameHint ?? UNTITLED_BOOKMARK_CATEGORY_LABEL}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${counterId} ${errorId}` : counterId}
                  />
                  <FieldError id={errorId}>{error}</FieldError>
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="color">
            {(field) => (
              <div>
                <span className="mb-2 block text-body-m-emphasis mobile:text-body-s-emphasis font-medium text-neutral-900">
                  색상
                </span>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      title={hex}
                      onClick={() => field.handleChange(hex)}
                      className="size-9 cursor-pointer rounded-full border-2 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      style={{
                        backgroundColor: hex,
                        borderColor: field.state.value === hex ? "#171717" : "transparent",
                        boxShadow:
                          field.state.value === hex ? "0 0 0 2px white, 0 0 0 4px #171717" : "",
                      }}
                      aria-pressed={field.state.value === hex}
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <label
                    htmlFor={`${formId}-color-custom`}
                    className="text-label-l-regular mobile:text-label-m-regular text-dark-gray"
                  >
                    직접 선택
                  </label>
                  <input
                    id={`${formId}-color-custom`}
                    type="color"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-md border border-gray-border bg-white p-0.5"
                  />
                  <span className="font-mono text-body-s-regular mobile:text-body-xs-regular text-dark-gray">
                    {field.state.value}
                  </span>
                </div>
              </div>
            )}
          </form.Field>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="weak" />}>취소</DialogClose>
          <Button
            type="submit"
            form={formId}
            loading={busy}
            loadingLabel={mode === "edit" ? "저장 중" : "추가 중"}
          >
            {mode === "edit" ? "저장" : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
