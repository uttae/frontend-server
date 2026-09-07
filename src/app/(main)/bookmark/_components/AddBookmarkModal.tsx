"use client";

import { useEffect, useState } from "react";
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

function initialColor(mode: Mode, initialFolder: BookmarkFolder | null) {
  if (mode === "edit" && initialFolder) return initialFolder.color;
  return COLOR_PRESETS[0];
}

export function AddBookmarkModal({
  mode,
  initialFolder,
  busy = false,
  onClose,
  onSave,
  overlayZClass = "z-50",
  /** 비어 있을 때 실제로 쓰이는 이름(다음 번호 반영). 없으면 기본 라벨만 표시 */
  untitledNameHint,
  /** 서버/저장 오류 시 인라인 표시 (토스트 대신) */
  formError = null,
}: {
  mode: Mode;
  initialFolder: BookmarkFolder | null;
  busy?: boolean;
  onClose: () => void;
  onSave: (payload: { title: string; color: string }) => void;
  /** 상위 모달 위에 겹칠 때만 지정 (예: `z-[65]`) */
  overlayZClass?: string;
  untitledNameHint?: string;
  formError?: string | null;
}) {
  const [title, setTitle] = useState(() => initialTitle(mode, initialFolder));
  const [color, setColor] = useState(() => initialColor(mode, initialFolder));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const trimmed = title.trim();
    onSave({
      title: trimmed,
      color,
    });
  };

  return (
    <div
      className={`fixed inset-0 ${overlayZClass} flex items-center justify-center bg-black/40 p-4`}
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-gray-border bg-white p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bookmark-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2
          id="bookmark-modal-title"
          className="text-[22px] font-semibold text-neutral-900"
        >
          {mode === "edit" ? "북마크 편집" : "새 북마크 추가"}
        </h2>
        {formError ? (
          <p className="mt-3 text-[17px] text-primary" role="alert">
            {formError}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <label
                htmlFor="bookmark-title"
                className="block text-[17px] font-medium text-neutral-900"
              >
                제목
              </label>
              <span
                id="bookmark-title-counter"
                className="shrink-0 text-[14px] tabular-nums text-dark-gray"
                aria-live="polite"
              >
                {title.length}/{TITLE_MAX_LENGTH}
              </span>
            </div>
            <input
              id="bookmark-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX_LENGTH}
              placeholder={untitledNameHint ?? UNTITLED_BOOKMARK_CATEGORY_LABEL}
              aria-describedby="bookmark-title-counter"
              className="w-full rounded-xl border border-gray-border px-3 py-2.5 text-[17px] outline-none ring-primary/30 focus:border-primary focus:ring-2"
            />
          </div>

          <div>
            <span className="mb-2 block text-[17px] font-medium text-neutral-900">
              색상
            </span>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  title={hex}
                  onClick={() => setColor(hex)}
                  className="size-9 cursor-pointer rounded-full border-2 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  style={{
                    backgroundColor: hex,
                    borderColor: color === hex ? "#171717" : "transparent",
                    boxShadow:
                      color === hex ? "0 0 0 2px white, 0 0 0 4px #171717" : "",
                  }}
                  aria-pressed={color === hex}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label
                htmlFor="bookmark-color-custom"
                className="text-[17px] text-dark-gray"
              >
                직접 선택
              </label>
              <input
                id="bookmark-color-custom"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-md border border-gray-border bg-white p-0.5"
              />
              <span className="font-mono text-[14px] text-dark-gray">{color}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 cursor-pointer rounded-xl border border-gray-border py-2.5 text-[17px] font-medium text-neutral-800 transition-colors hover:bg-bubble-gray"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 cursor-pointer rounded-xl bg-primary py-2.5 text-[17px] font-semibold text-white shadow-md transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mode === "edit" ? "저장" : "추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
