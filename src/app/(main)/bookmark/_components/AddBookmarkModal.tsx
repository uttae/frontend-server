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
import {
  BOOKMARK_FOLDER_TITLE_MAX_LENGTH,
  bookmarkFolderFormSchema,
  bookmarkFolderTitleSchema,
} from "@/lib/bookmarks/bookmark-folder-form";

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
    return initialFolder.title.slice(0, BOOKMARK_FOLDER_TITLE_MAX_LENGTH);
  }
  return "";
}

function initialColor(mode: Mode, initialFolder: BookmarkFolder | null): string {
  if (mode === "edit" && initialFolder) return initialFolder.color;
  return COLOR_PRESETS[0];
}

export function AddBookmarkModal({
  mode,
  initialFolder,
  busy = false,
  onClose,
  onSave,
  untitledNameHint,
  formError = null,
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
  const form = useForm({
    defaultValues: {
      title: initialTitle(mode, initialFolder),
      color: initialColor(mode, initialFolder),
    },
    onSubmit: ({ value }) => {
      onSave(bookmarkFolderFormSchema.parse(value));
    },
  });

  return (
    <Dialog
      open
      closeDisabled={busy}
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
            if (busy || form.state.isSubmitting) return;
            void form.handleSubmit();
          }}
        >
          <form.Field name="title" validators={{ onSubmit: bookmarkFolderTitleSchema }}>
            {(field) => {
              const error = field.state.meta.errors[0]?.message;
              const counterId = `${formId}-title-counter`;
              const errorId = `${formId}-title-error`;
              return (
                <Field>
                  <FieldHeader>
                    <FieldLabel htmlFor={`${formId}-title`}>제목</FieldLabel>
                    <FieldSuffix id={counterId} aria-live="polite">
                      {field.state.value.length}/{BOOKMARK_FOLDER_TITLE_MAX_LENGTH}
                    </FieldSuffix>
                  </FieldHeader>
                  <Input
                    id={`${formId}-title`}
                    type="text"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    maxLength={BOOKMARK_FOLDER_TITLE_MAX_LENGTH}
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
