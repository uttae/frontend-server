"use client";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Spinner } from "@/components/ui/spinner";
import { PlanLoadingSkeleton } from "../PlanLoadingSkeleton";

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
import { useOpenPlaceOnMap } from "@/hooks/useOpenPlaceOnMap";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import { bucketItemCount } from "@/lib/analytics/context";
import { placePreviewQueryOptions } from "@/lib/places/place-queries";
import type { PlacePreview } from "@/lib/api/places";
import type { RoomBookmark, RoomScheduleItem } from "@/lib/api/rooms";
import type { PlanPlace } from "@/lib/plan/types";
import { cn } from "@/lib/utils";

type AddFromBookmarkModalProps = {
  roomId: string;
  scheduleId: number;
  places: PlanPlace[];
  /** 지정 시 해당 index에 삽입, 없으면 맨 뒤 */
  insertIndex?: number;
  /** 추가 성공 직후 — 모바일에서 새 카드로 스크롤할 때 쓴다 */
  onAdded?: (item: RoomScheduleItem) => void;
  onClose: () => void;
};

export function AddFromBookmarkModal({
  roomId,
  scheduleId,
  places,
  insertIndex,
  onAdded,
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
    isLoadingError: categoriesError,
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

  const {
    data: bookmarkRows,
    isPending: bookmarksLoading,
    isLoadingError: bookmarksError,
    error: bookmarksErr,
    refetch: refetchBookmarks,
  } = useRoomBookmarks(roomId, selectedCategoryId);

  const bookmarkListReady =
    !bookmarksLoading && bookmarkRows !== undefined;

  const bookmarkItems: RoomBookmark[] = useMemo(
    () => Array.isArray(bookmarkRows) ? bookmarkRows : [],
    [bookmarkRows],
  );

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
        const { createdItem: created } = await createItem({
          roomId,
          scheduleId,
          googlePlaceId: gid,
          insertIndex: index,
          placesSnapshot: places,
        });
        trackAnalyticsEvent(AnalyticsEvents.addToItinerary, {
          room_id: roomId,
          item_count_bucket: bucketItemCount(places.length + 1),
          interaction_source: "bookmark",
        });
        toast.success("일정에 추가했어요.");
        onAdded?.(created);
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
      onAdded,
      onClose,
      places,
      roomId,
      scheduleId,
    ],
  );

  const openPlaceOnMap = useOpenPlaceOnMap();
  const selectedCategoryColor = categories?.find(
    (c) => c.categoryId === selectedCategoryId,
  )?.colorCode;

  const handleOpenOnMap = useCallback(
    (googlePlaceId: string, preview: PlacePreview) => {
      if (busy) return;
      onClose();
      openPlaceOnMap(
        {
          name: preview.name,
          category: "",
          rating: null,
          address: preview.formattedAddress,
          googlePlaceId: googlePlaceId.trim(),
          location: preview.location,
          fromBookmark: true,
          bookmarkCategoryColor: selectedCategoryColor,
        },
        { itinerarySource: "bookmark" },
      );
    },
    [busy, onClose, openPlaceOnMap, selectedCategoryColor],
  );

  return (
    // PC는 가운데 대화상자, 모바일 기기는 아래 시트(DECISIONS 'Dialog' 반응형). 추가 중(busy)에는 Esc·딤·닫기·스와이프로 닫히지 않는다
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      closeDisabled={busy}
    >
      {/* 높이 상한은 지금 값. 폴더 칩·제목은 고정하고 장소 목록만 스크롤한다. 지금 PC 모달에는 닫기 X가 없다(아래 닫기 버튼) */}
      <ResponsiveDialogContent
        size="md"
        showCloseButton={false}
        closeLabel="북마크에서 추가 닫기"
        className="max-h-[min(85vh,560px)]"
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>북마크에서 추가</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>북마크 장소를 이 일차에 추가해요.</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="min-h-0 flex-1 gap-3">
        {categoriesLoading ? (
          <div className="px-5 py-6 text-center"><Spinner aria-label="북마크 불러오는 중" /></div>
        ) : categoriesError ? (
          <div className="space-y-2 px-5 py-6 text-center">
            <p className="text-body-m-regular mobile:text-body-s-regular text-primary">
              {categoriesErr instanceof Error
                ? categoriesErr.message
                : "북마크를 불러오지 못했습니다."}
            </p>
            <button
              type="button"
              onClick={() => void refetchCategories()}
              className="cursor-pointer text-label-l-regular mobile:text-label-m-regular font-medium text-neutral-900 underline"
            >
              다시 시도
            </button>
          </div>
        ) : !categories?.length ? (
          <div className="px-5 py-8 text-center">
            <p className="text-body-s-regular mobile:text-body-xs-regular leading-relaxed text-dark-gray break-keep text-pretty">
              아직 북마크가 없어요.
            </p>
          </div>
        ) : (
          <>
            {/* 칩 줄과 목록은 지금처럼 표면 끝까지 닿는다. 표면(Dialog p-5·시트 Body px-5)의 좌우 20px만큼 넓힌다 */}
            <div className="-mx-5 shrink-0 overflow-x-auto overscroll-x-contain px-5 [scrollbar-color:rgba(0,0,0,0.15)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/15">
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
                        "flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-left text-label-m-regular mobile:text-label-s-regular font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
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

            <div className="-mx-5 min-h-0 flex-1 overflow-y-auto border-t border-gray-border [scrollbar-color:rgba(0,0,0,0.15)_transparent]">
              {bookmarksLoading ? (
                <PlanLoadingSkeleton places className="px-5" />
              ) : bookmarksError ? (
                <div className="space-y-2 px-5 py-6 text-center">
                  <p className="text-body-m-regular mobile:text-body-s-regular text-primary">
                    {bookmarksErr instanceof Error
                      ? bookmarksErr.message
                      : "장소 목록을 불러오지 못했습니다."}
                  </p>
                  <button
                    type="button"
                    onClick={() => void refetchBookmarks()}
                    className="cursor-pointer text-label-l-regular mobile:text-label-m-regular font-medium text-neutral-900 underline"
                  >
                    다시 시도
                  </button>
                </div>
              ) : cardsLoading && bookmarkPlaces.length === 0 ? (
                <PlanLoadingSkeleton places className="px-5" />
              ) : bookmarkPlaces.length === 0 ? (
                <p className="px-5 py-8 text-center text-body-m-regular mobile:text-body-s-regular text-dark-gray">
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
                      onThumbnailClick={() =>
                        handleOpenOnMap(googlePlaceId, preview)
                      }
                    />
                  );
                })
              )}
            </div>
          </>
        )}

        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <ResponsiveDialogClose render={<Button variant="weak" />}>닫기</ResponsiveDialogClose>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
