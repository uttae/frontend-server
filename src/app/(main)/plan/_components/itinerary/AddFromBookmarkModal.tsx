"use client";

import { useQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FolderRibbonIcon } from "@/app/(main)/bookmark/_components/FolderRibbonIcon";
import { BookmarkPlacePreviewCard } from "@/app/(main)/bookmark/_components/BookmarkPlacePreviewCard";
import {
  useAllRoomBookmarks,
  useBookmarkCategories,
  useCreateScheduleItem,
  useRoomBookmarks,
} from "@/hooks/useRooms";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import { bucketItemCount } from "@/lib/analytics/context";
import { placePreviewQueryOptions } from "@/lib/places/place-queries";
import type { RoomBookmark } from "@/lib/api/rooms";
import type { PlanPlace } from "@/lib/plan/types";
import { cn } from "@/lib/utils";

type AddFromBookmarkModalProps = {
  roomId: string;
  scheduleId: number;
  places: PlanPlace[];
  /** 지정 시 해당 index에 삽입, 없으면 맨 뒤 */
  insertIndex?: number;
  onClose: () => void;
};

export function AddFromBookmarkModal({
  roomId,
  scheduleId,
  places,
  insertIndex,
  onClose,
}: AddFromBookmarkModalProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [addingGooglePlaceId, setAddingGooglePlaceId] = useState<
    string | null
  >(null);

  const {
    data: categories,
    isPending: categoriesLoading,
    isError: categoriesError,
    error: categoriesErr,
    refetch: refetchCategories,
  } = useBookmarkCategories(roomId);

  useAllRoomBookmarks(roomId);

  useEffect(() => {
    if (!categories?.length) return;
    setSelectedCategoryId((prev) => {
      if (prev != null && categories.some((c) => c.categoryId === prev)) {
        return prev;
      }
      return categories[0]!.categoryId;
    });
  }, [categories]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const {
    data: bookmarkRows,
    isPending: bookmarksLoading,
    isError: bookmarksError,
    error: bookmarksErr,
    refetch: refetchBookmarks,
  } = useRoomBookmarks(roomId, selectedCategoryId);

  const bookmarkListReady =
    !bookmarksLoading && bookmarkRows !== undefined;

  const bookmarkItems: RoomBookmark[] = Array.isArray(bookmarkRows)
    ? bookmarkRows
    : [];

  const placeQueryDefs = useMemo(() => {
    if (!bookmarkListReady) return [];
    return bookmarkItems
      .map((b) => {
        const googlePlaceId =
          typeof b.googlePlaceId === "string" ? b.googlePlaceId.trim() : "";
        if (!googlePlaceId.length) return null;
        return {
          bookmarkId: b.bookmarkId,
          ...placePreviewQueryOptions(googlePlaceId),
        };
      })
      .filter((q): q is NonNullable<typeof q> => q != null);
  }, [bookmarkListReady, bookmarkItems]);

  const placeQueries = useQueries({ queries: placeQueryDefs });

  const bookmarkPlaces = useMemo(() => {
    if (!placeQueryDefs.length) return [];
    return placeQueryDefs
      .map((def, i) => {
        const preview = placeQueries[i]?.data;
        if (!preview) return null;
        const row = bookmarkItems.find((r) => r.bookmarkId === def.bookmarkId);
        if (!row) return null;
        return {
          bookmarkId: row.bookmarkId,
          googlePlaceId: row.googlePlaceId,
          preview,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p != null);
  }, [bookmarkItems, placeQueryDefs, placeQueries]);

  const cardsLoading =
    bookmarkListReady &&
    bookmarkItems.length > 0 &&
    placeQueries.some((q) => q.isPending || q.isFetching);

  const existingPlaceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of places) {
      const gid =
        typeof p.googlePlaceId === "string" ? p.googlePlaceId.trim() : "";
      if (gid.length > 0) ids.add(gid);
    }
    return ids;
  }, [places]);

  const { mutateAsync: createItem, isPending: isCreatingItem } =
    useCreateScheduleItem();

  const busy = isCreatingItem || addingGooglePlaceId != null;

  const handleAddPlace = useCallback(
    async (googlePlaceId: string) => {
      const gid = googlePlaceId.trim();
      if (!gid.length || busy) return;

      if (existingPlaceIds.has(gid)) {
        toast.info("이미 이 일차에 추가된 장소예요.");
        return;
      }

      setAddingGooglePlaceId(gid);
      const index = insertIndex ?? places.length;
      try {
        await createItem({
          roomId,
          scheduleId,
          googlePlaceId: gid,
          insertIndex: index,
          placesSnapshot: places,
        });
        trackAnalyticsEvent(AnalyticsEvents.addToItinerary, {
          item_count_bucket: bucketItemCount(places.length + 1),
          interaction_source: "bookmark",
        });
        toast.success("일정에 추가했어요.");
        onClose();
      } catch {
        toast.error("장소를 일정에 추가하지 못했어요.");
      } finally {
        setAddingGooglePlaceId(null);
      }
    },
    [
      busy,
      createItem,
      existingPlaceIds,
      insertIndex,
      onClose,
      places,
      roomId,
      scheduleId,
    ],
  );

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
        aria-labelledby="add-from-bookmark-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "flex max-h-[min(85vh,560px)] w-full flex-col overflow-hidden",
          "border-t border-gray-border bg-white shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.12)] md:rounded-2xl md:border md:shadow-lg",
          "rounded-t-[1.35rem]",
          "mx-auto md:max-w-md",
          "pb-[max(env(safe-area-inset-bottom,0px),12px)]",
        )}
      >
        <div
          aria-hidden
          className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-black/15 md:hidden"
        />

        <div className="shrink-0 px-5 pb-2 pt-3">
          <h2
            id="add-from-bookmark-modal-title"
            className="text-[22px] font-semibold text-neutral-900"
          >
            북마크에서 추가
          </h2>
          <p className="mt-1 text-[14px] leading-relaxed text-dark-gray break-keep text-pretty">
            북마크 장소를 이 일차에 추가해요.
          </p>
        </div>

        {categoriesLoading ? (
          <p className="px-5 py-6 text-center text-[17px] text-dark-gray">
            불러오는 중…
          </p>
        ) : categoriesError ? (
          <div className="space-y-2 px-5 py-6 text-center">
            <p className="text-[17px] text-primary">
              {categoriesErr instanceof Error
                ? categoriesErr.message
                : "북마크를 불러오지 못했습니다."}
            </p>
            <button
              type="button"
              onClick={() => void refetchCategories()}
              className="cursor-pointer text-[17px] font-medium text-neutral-900 underline"
            >
              다시 시도
            </button>
          </div>
        ) : !categories?.length ? (
          <div className="px-5 py-8 text-center">
            <p className="text-[14px] leading-relaxed text-dark-gray break-keep text-pretty">
              아직 북마크가 없어요.
            </p>
          </div>
        ) : (
          <>
            <div className="shrink-0 overflow-x-auto overscroll-x-contain px-5 pb-3 [scrollbar-color:rgba(0,0,0,0.15)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/15">
              <div className="flex w-max gap-2">
                {categories.map((c) => {
                  const selected = selectedCategoryId === c.categoryId;
                  return (
                    <button
                      key={c.categoryId}
                      type="button"
                      disabled={busy}
                      aria-pressed={selected}
                      onClick={() => setSelectedCategoryId(c.categoryId)}
                      className={cn(
                        "flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-left text-[14px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                        selected
                          ? "border-primary bg-primary/10 text-gray-900"
                          : "border-gray-border bg-white text-dark-gray hover:bg-gray-50",
                      )}
                    >
                      <FolderRibbonIcon
                        color={c.colorCode}
                        className="size-5"
                      />
                      <span className="max-w-[8rem] truncate">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto border-t border-gray-border [scrollbar-color:rgba(0,0,0,0.15)_transparent]">
              {bookmarksLoading ? (
                <p className="px-5 py-6 text-center text-[17px] text-dark-gray">
                  장소 목록을 불러오는 중…
                </p>
              ) : bookmarksError ? (
                <div className="space-y-2 px-5 py-6 text-center">
                  <p className="text-[17px] text-primary">
                    {bookmarksErr instanceof Error
                      ? bookmarksErr.message
                      : "장소 목록을 불러오지 못했습니다."}
                  </p>
                  <button
                    type="button"
                    onClick={() => void refetchBookmarks()}
                    className="cursor-pointer text-[17px] font-medium text-neutral-900 underline"
                  >
                    다시 시도
                  </button>
                </div>
              ) : cardsLoading && bookmarkPlaces.length === 0 ? (
                <p className="px-5 py-6 text-center text-[17px] text-dark-gray">
                  장소 정보를 불러오는 중…
                </p>
              ) : bookmarkPlaces.length === 0 ? (
                <p className="px-5 py-8 text-center text-[17px] text-dark-gray">
                  담긴 장소가 없습니다.
                </p>
              ) : (
                bookmarkPlaces.map(({ bookmarkId, googlePlaceId, preview }) => {
                  const gid = googlePlaceId.trim();
                  const alreadyAdded = existingPlaceIds.has(gid);
                  const rowAdding = addingGooglePlaceId === gid;

                  return (
                    <BookmarkPlacePreviewCard
                      key={bookmarkId}
                      name={preview.name}
                      address={preview.formattedAddress}
                      primaryTypeDisplayName={preview.primaryTypeDisplayName}
                      googlePlaceId={googlePlaceId}
                      className={cn(
                        "w-full border-x-0 px-5",
                        alreadyAdded && "opacity-50",
                        rowAdding && "cursor-wait opacity-70",
                        busy && !rowAdding && "pointer-events-none opacity-60",
                      )}
                      onClick={() => void handleAddPlace(googlePlaceId)}
                    />
                  );
                })
              )}
            </div>
          </>
        )}

        <div className="shrink-0 border-t border-gray-border px-5 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="w-full cursor-pointer rounded-xl border border-gray-border py-2.5 text-[17px] font-medium text-neutral-800 transition-colors hover:bg-bubble-gray disabled:cursor-not-allowed disabled:opacity-60"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
