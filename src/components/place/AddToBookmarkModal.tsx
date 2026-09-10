"use client";

import { Check, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { messageForBookmarkCategorySaveError } from "@/lib/api/errors";
import { AddBookmarkModal } from "@/app/(main)/bookmark/_components/AddBookmarkModal";
import { FolderRibbonIcon } from "@/app/(main)/bookmark/_components/FolderRibbonIcon";
import { pickUniqueUntitledBookmarkCategoryName } from "@/lib/bookmark-untitled-category-name";
import {
  useBookmarkCategories,
  useCreateBookmarkCategory,
  useCreateRoomBookmarksInCategories,
} from "@/hooks/useRooms";
import {
  AnalyticsEvents,
  trackAnalyticsEvent,
  type ItinerarySource,
} from "@/lib/analytics/track";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";

type Props = {
  googlePlaceId: string;
  placeCategory?: string;
  source?: ItinerarySource;
  onClose: () => void;
  onAdded?: () => void;
};

export function AddToBookmarkModal({
  googlePlaceId,
  placeCategory,
  source,
  onClose,
  onAdded,
}: Props) {
  const roomId = useSessionStore((s) => s.currentRoomId);
  const {
    data: categories,
    isPending: categoriesLoading,
    isError: categoriesError,
    error: categoriesErr,
    refetch,
  } = useBookmarkCategories(roomId);
  const { mutate: addBookmarksBulk, isPending: isAddingBookmarks } =
    useCreateRoomBookmarksInCategories();
  const { mutate: createCategory, isPending: isCreatingCategory } =
    useCreateBookmarkCategory();
  const [submitFeedback, setSubmitFeedback] = useState<{
    message: string;
    variant: "error" | "neutral";
  } | null>(null);
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [createFolderModalKey, setCreateFolderModalKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState(() => new Set<number>());

  const toggleCategory = useCallback((categoryId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
    setSubmitFeedback(null);
  }, []);

  useEffect(() => {
    if (createFolderModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, createFolderModalOpen]);

  const openCreateFolderModal = () => {
    setCreateFolderModalKey((k) => k + 1);
    setCreateFolderModalOpen(true);
  };

  const selectedAsArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const notifyResult = useCallback(
    ({
      added,
      skippedDuplicate,
      firstHardError,
    }: {
      added: number;
      skippedDuplicate: number;
      firstHardError: Error | null;
    }) => {
      if (firstHardError) {
        const parts = [firstHardError.message];
        if (added > 0) {
          parts.push(`추가한 북마크는 ${added}개예요`);
        }
        setSubmitFeedback({
          message: parts.join(" "),
          variant: "error",
        });
        return;
      }
      if (added > 0 && skippedDuplicate > 0) {
        setSubmitFeedback({
          message: `${added}개 북마크에 추가했어요. ${skippedDuplicate}개 북마크에는 이미 이 장소가 있어요.`,
          variant: "neutral",
        });
      } else if (added === 0 && skippedDuplicate > 0) {
        setSubmitFeedback({
          message: "해당 장소가 모든 선택 카테고리에 이미 추가되어 있어요.",
          variant: "error",
        });
      }
    },
    [],
  );

  const handleConfirmAdd = () => {
    if (!roomId || isAddingBookmarks) return;
    if (selectedAsArray.length === 0) {
      setSubmitFeedback({
        message: "북마크를 하나 이상 선택해 주세요.",
        variant: "error",
      });
      return;
    }
    setSubmitFeedback(null);
    addBookmarksBulk(
      {
        roomId,
        googlePlaceId,
        categoryIds: selectedAsArray,
      },
      {
        onSuccess: (result) => {
          notifyResult(result);
          if (result.added > 0) {
            trackAnalyticsEvent(AnalyticsEvents.addToBookmark, {
              place_category: placeCategory,
              interaction_source: source,
            });
            onAdded?.();
          }
          if (!result.firstHardError && result.skippedDuplicate === 0) {
            onClose();
          }
        },
      },
    );
  };

  const handleCreateFolderSave = ({
    title,
    color,
  }: {
    title: string;
    color: string;
  }) => {
    if (!roomId || isCreatingCategory || isAddingBookmarks) return;
    const resolvedName = title.trim()
      ? title.trim()
      : pickUniqueUntitledBookmarkCategoryName(
          (categories ?? []).map((c) => c.name),
        );
    createCategory(
      { roomId, name: resolvedName, colorCode: color },
      {
        onSuccess: (created) => {
          trackAnalyticsEvent(AnalyticsEvents.createBookmarkFolder);
          setCreateFolderModalOpen(false);
          setSubmitFeedback(null);
          setSelectedIds((prev) => new Set(prev).add(created.categoryId));
        },
        onError: (e) => {
          setCreateFolderModalOpen(false);
          setSubmitFeedback({
            message: messageForBookmarkCategorySaveError(
              e,
              "카테고리를 만들지 못했습니다.",
            ),
            variant: "error",
          });
        },
      },
    );
  };

  if (!roomId) {
    return null;
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/40 md:justify-center md:px-4"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-bookmark-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "flex max-h-[min(85vh,560px)] w-full flex-col overflow-hidden",
          "border-t border-gray-border bg-white shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.12)] md:rounded-2xl md:border md:shadow-lg",
          "rounded-t-[1.35rem]",
          "mx-auto md:max-w-sm",
          "pb-[max(env(safe-area-inset-bottom,0px),12px)]",
        )}
      >
        <div
          aria-hidden
          className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-black/15 md:hidden"
        />

        <div className="shrink-0 px-5 pb-2 pt-3">
          <h2
            id="add-bookmark-modal-title"
            className="text-[22px] font-semibold text-neutral-900"
          >
            북마크에 추가
          </h2>
          <p className="mt-1 text-[14px] leading-relaxed text-dark-gray break-keep text-pretty">
            북마크를 선택한 뒤 추가해 주세요.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:rgba(0,0,0,0.15)_transparent] [scrollbar-gutter:stable]">
          <button
            type="button"
            disabled={isCreatingCategory || isAddingBookmarks}
            onClick={openCreateFolderModal}
            className={cn(
              "flex w-full items-center gap-2.5 border-b border-gray-border px-5 py-3.5 text-left text-[17px] font-medium text-neutral-900 transition-colors hover:bg-bubble-gray",
              "disabled:opacity-55",
            )}
          >
            <Plus className="size-4 shrink-0 stroke-[2.25]" aria-hidden />
            <span className="break-keep">새 북마크 만들기</span>
          </button>

          {categoriesLoading && (
            <p className="px-5 py-6 text-center text-[17px] text-dark-gray">
              불러오는 중…
            </p>
          )}

          {categoriesError && (
            <div className="space-y-2 px-5 py-6 text-center">
              <p className="text-[17px] text-primary">
                {categoriesErr instanceof Error
                  ? categoriesErr.message
                  : "카테고리를 불러오지 못했습니다."}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-[17px] font-medium text-neutral-900 underline"
              >
                다시 시도
              </button>
            </div>
          )}

          {categories && categories.length === 0 && !categoriesLoading && (
            <div className="px-5 py-8 text-center">
              <p className="text-[14px] leading-relaxed text-dark-gray break-keep text-pretty">
                아직 북마크가 없어요.
              </p>
            </div>
          )}

          {categories && categories.length > 0 && (
            <div className="w-full bg-white">
              <ul role="list" className="divide-y divide-gray-border">
                {categories.map((c) => {
                  const sel = selectedIds.has(c.categoryId);
                  return (
                    <li key={c.categoryId}>
                      <button
                        type="button"
                        disabled={isAddingBookmarks}
                        aria-pressed={sel}
                        aria-label={`${c.name} 북마크에서 ${sel ? "선택 해제" : "선택"}`}
                        onClick={() => toggleCategory(c.categoryId)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-bubble-gray/60",
                          "disabled:opacity-60",
                        )}
                      >
                        <FolderRibbonIcon color={c.colorCode} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-lg font-medium text-neutral-900">
                            {c.name}
                          </p>
                          <p className="mt-0.5 text-[17px] text-dark-gray">
                            {c.placeCount ?? 0}개 장소
                          </p>
                        </div>
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                            sel
                              ? "border-primary bg-primary text-white shadow-sm"
                              : "border-gray-300 bg-white text-transparent",
                          )}
                        >
                          <Check className="size-[1.125rem]" strokeWidth={3} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {submitFeedback && (
            <p
              className={cn(
                "border-t border-gray-border px-5 py-3 text-center text-[17px]",
                submitFeedback.variant === "error"
                  ? "text-primary"
                  : "text-dark-gray",
              )}
            >
              {submitFeedback.message}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-gray-border px-5 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isAddingBookmarks}
            className="flex-1 rounded-xl border border-gray-border py-2.5 text-[17px] font-medium text-neutral-800 transition-colors hover:bg-bubble-gray disabled:opacity-60"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleConfirmAdd}
            disabled={
              isAddingBookmarks ||
              selectedIds.size === 0 ||
              (categories?.length === 0 && !categoriesLoading)
            }
            className="flex-1 rounded-xl bg-primary py-2.5 text-[17px] font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-55"
          >
            {isAddingBookmarks ? "추가 중…" : "추가"}
          </button>
        </div>
      </div>

      {createFolderModalOpen && (
        <AddBookmarkModal
          key={createFolderModalKey}
          mode="create"
          initialFolder={null}
          overlayZClass="z-[65]"
          busy={isCreatingCategory || isAddingBookmarks}
          untitledNameHint={pickUniqueUntitledBookmarkCategoryName(
            (categories ?? []).map((c) => c.name),
          )}
          onClose={() => setCreateFolderModalOpen(false)}
          onSave={handleCreateFolderSave}
        />
      )}
    </div>
  );
}
