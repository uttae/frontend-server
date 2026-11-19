"use client";

import { Check, Plus } from "lucide-react";
import { useCallback, useMemo, useState, type SyntheticEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

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

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();
const pointerBoundary = {
  onClick: stopPropagation,
  onMouseDown: stopPropagation,
  onPointerDown: stopPropagation,
  onTouchStart: stopPropagation,
};

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
  const [submitError, setSubmitError] = useState<string | null>(null);
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
    setSubmitError(null);
  }, []);

  const openCreateFolderModal = () => {
    setCreateFolderModalKey((k) => k + 1);
    setCreateFolderModalOpen(true);
  };

  const selectedAsArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const handleConfirmAdd = () => {
    if (!roomId || isAddingBookmarks) return;
    if (selectedAsArray.length === 0) {
      setSubmitError("북마크를 하나 이상 선택해 주세요.");
      return;
    }
    setSubmitError(null);
    addBookmarksBulk(
      {
        roomId,
        googlePlaceId,
        categoryIds: selectedAsArray,
      },
      {
        onSuccess: (bookmarks) => {
          if (bookmarks.length > 0) {
            trackAnalyticsEvent(AnalyticsEvents.addToBookmark, {
              room_id: roomId,
              place_category: placeCategory,
              interaction_source: source,
            });
            onAdded?.();
            toast.success("북마크에 추가했어요.");
          } else {
            toast.info("이미 북마크에 추가된 장소예요.");
          }
          onClose();
        },
        onError: () => {
          toast.error("북마크에 추가하지 못했어요.");
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
          trackAnalyticsEvent(AnalyticsEvents.createBookmarkFolder, {
            room_id: roomId,
          });
          setCreateFolderModalOpen(false);
          setSubmitError(null);
          setSelectedIds((prev) => new Set(prev).add(created.categoryId));
        },
        onError: (e) => {
          setCreateFolderModalOpen(false);
          setSubmitError(
            messageForBookmarkCategorySaveError(
              e,
              "카테고리를 만들지 못했습니다.",
            ),
          );
        },
      },
    );
  };

  if (!roomId) {
    return null;
  }

  return (
    <Dialog
      open
      closeDisabled={isAddingBookmarks}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent {...pointerBoundary} backdropProps={pointerBoundary} size="sm" showCloseButton={false} className="max-h-[min(85dvh,560px)]">
        <DialogHeader>
          <DialogTitle>북마크에 추가</DialogTitle>
          <DialogDescription>북마크를 선택한 뒤 추가해 주세요.</DialogDescription>
        </DialogHeader>

        <div className="-mx-5 min-h-0 overflow-y-auto border-b border-gray-border [scrollbar-color:rgba(0,0,0,0.15)_transparent] [scrollbar-gutter:stable]">
          <button
            type="button"
            disabled={isCreatingCategory || isAddingBookmarks}
            onClick={openCreateFolderModal}
            className={cn(
              "flex w-full items-center gap-2.5 border-b border-gray-border px-5 py-3.5 text-left text-label-l-regular mobile:text-label-m-regular font-medium text-neutral-900 transition-colors hover:bg-bubble-gray",
              "disabled:opacity-55",
            )}
          >
            <Plus className="size-4 shrink-0 stroke-[2.25]" aria-hidden />
            <span className="break-keep">새 북마크 만들기</span>
          </button>

          {categoriesLoading && (
            <div className="flex justify-center py-6">
              <Spinner aria-label="북마크 불러오는 중" />
            </div>
          )}

          {categoriesError && (
            <div className="space-y-2 px-5 py-6 text-center">
              <p className="text-body-m-regular mobile:text-body-s-regular text-primary">
                {categoriesErr instanceof Error
                  ? categoriesErr.message
                  : "카테고리를 불러오지 못했습니다."}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-label-l-regular mobile:text-label-m-regular font-medium text-neutral-900 underline"
              >
                다시 시도
              </button>
            </div>
          )}

          {categories && categories.length === 0 && !categoriesLoading && (
            <div className="px-5 py-8 text-center">
              <p className="text-body-s-regular mobile:text-body-xs-regular leading-relaxed text-dark-gray break-keep text-pretty">
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
                          <p className="truncate text-body-l-emphasis mobile:text-body-m-emphasis font-medium text-neutral-900">
                            {c.name}
                          </p>
                          <p className="mt-0.5 text-body-m-regular mobile:text-body-s-regular text-dark-gray">
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

          {submitError && (
            <p className="border-t border-gray-border px-5 py-3 text-center text-body-m-regular mobile:text-body-s-regular text-primary">
              {submitError}
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="weak" />}>닫기</DialogClose>
          <Button
            loading={isAddingBookmarks}
            loadingLabel="추가 중"
            disabled={
              selectedIds.size === 0 ||
              (categories?.length === 0 && !categoriesLoading)
            }
            onClick={handleConfirmAdd}
          >
            추가
          </Button>
        </DialogFooter>

        {createFolderModalOpen && (
          <AddBookmarkModal
            key={createFolderModalKey}
            mode="create"
            initialFolder={null}
            busy={isCreatingCategory || isAddingBookmarks}
            untitledNameHint={pickUniqueUntitledBookmarkCategoryName(
              (categories ?? []).map((c) => c.name),
            )}
            onClose={() => setCreateFolderModalOpen(false)}
            onSave={handleCreateFolderSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
