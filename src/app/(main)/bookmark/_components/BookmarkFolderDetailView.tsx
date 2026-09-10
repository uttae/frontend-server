"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import { placePreviewQueryOptions } from "@/lib/places/place-queries";
import { useSelectedPlace } from "@/contexts/SelectedPlaceContext";
import { useAllRoomBookmarks, useRoomBookmarks } from "@/hooks/useRooms";
import { useSessionStore } from "@/stores/session-store";
import type { RoomBookmark } from "@/lib/api/rooms";
import type { BookmarkFolder, BookmarkedPlace } from "@/types/bookmark";
import { BookmarkFolderDetailHeader } from "./BookmarkFolderDetailHeader";
import { BookmarkPlaceRow } from "./BookmarkPlaceRow";

const SCROLLBAR =
  "min-h-0 flex-1 overflow-y-auto [scrollbar-color:rgba(0,0,0,0.2)_transparent]";

function trimGooglePlaceId(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function normalizeBookmarkRows(data: unknown): RoomBookmark[] {
  return Array.isArray(data) ? data : [];
}

export function BookmarkFolderDetailView({ folder }: { folder: BookmarkFolder }) {
  const { setSelectedPlace } = useSelectedPlace();
  const roomId = useSessionStore((s) => s.currentRoomId);
  const categoryId = Number.parseInt(folder.id, 10);
  const categoryIdOk = Number.isFinite(categoryId) ? categoryId : null;

  useAllRoomBookmarks(roomId);

  const {
    data: bookmarkRowsRaw,
    isPending: bookmarksLoading,
    isError: bookmarksError,
    error: bookmarksErr,
    refetch,
  } = useRoomBookmarks(roomId, categoryIdOk);

  const bookmarkRows = useMemo(
    () => normalizeBookmarkRows(bookmarkRowsRaw),
    [bookmarkRowsRaw],
  );

  const bookmarkListReady =
    !bookmarksLoading && bookmarkRowsRaw !== undefined && !!roomId;

  const placeQueryDefs = useMemo(() => {
    if (!bookmarkListReady) return [];
    return bookmarkRows
      .map((b) => {
        const googlePlaceId = trimGooglePlaceId(b.googlePlaceId);
        if (!googlePlaceId.length) return null;
        return {
          bookmarkId: b.bookmarkId,
          ...placePreviewQueryOptions(googlePlaceId),
        };
      })
      .filter((q): q is NonNullable<typeof q> => q != null);
  }, [bookmarkListReady, bookmarkRows]);

  const placeQueries = useQueries({ queries: placeQueryDefs });

  const places: BookmarkedPlace[] = useMemo(() => {
    const out: BookmarkedPlace[] = [];
    placeQueryDefs.forEach((def, i) => {
      const preview = placeQueries[i]?.data;
      if (!preview) return;
      const row = bookmarkRows.find((r) => r.bookmarkId === def.bookmarkId);
      if (!row) return;
      out.push({
        id: String(row.bookmarkId),
        name: preview.name,
        address: preview.formattedAddress,
        primaryTypeDisplayName: preview.primaryTypeDisplayName,
        googlePlaceId: preview.googlePlaceId,
        location: preview.location,
      });
    });
    return out;
  }, [bookmarkRows, placeQueryDefs, placeQueries]);

  const cardsLoading =
    bookmarkListReady &&
    bookmarkRows.length > 0 &&
    placeQueries.some((q) => q.isPending || q.isFetching);

  const cardsError =
    bookmarkListReady &&
    bookmarkRows.length > 0 &&
    places.length === 0 &&
    placeQueries.length > 0 &&
    placeQueries.every((q) => q.isError);

  const firstPlaceError = placeQueries.find((q) => q.isError)?.error;

  const retryPlacePreviews = () => {
    for (const q of placeQueries) {
      void q.refetch();
    }
  };

  if (!roomId) {
    return null;
  }

  if (categoryIdOk == null) {
    return (
      <>
        <BookmarkFolderDetailHeader folder={folder} />
        <div className={`${SCROLLBAR} py-10`}>
          <p className="text-center text-[17px] text-dark-gray">
            유효하지 않은 카테고리입니다.
          </p>
        </div>
      </>
    );
  }

  if (bookmarksLoading) {
    return (
      <>
        <BookmarkFolderDetailHeader folder={folder} />
        <div className={`${SCROLLBAR} py-10`}>
          <p className="text-center text-[17px] text-dark-gray">불러오는 중…</p>
        </div>
      </>
    );
  }

  if (bookmarksError) {
    return (
      <>
        <BookmarkFolderDetailHeader folder={folder} />
        <div className={`${SCROLLBAR} space-y-3 py-10`}>
          <p className="text-center text-[17px] text-primary">
            {bookmarksErr instanceof Error
              ? bookmarksErr.message
              : "목록을 불러오지 못했습니다."}
          </p>
          <div className="text-center">
            <button
              type="button"
              onClick={() => refetch()}
              className="cursor-pointer text-[17px] font-medium text-neutral-900 underline"
            >
              다시 시도
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <BookmarkFolderDetailHeader folder={folder} />
      <div className={SCROLLBAR}>
        {cardsLoading ? (
          <p className="py-10 text-center text-[17px] text-dark-gray">
            장소 정보를 불러오는 중…
          </p>
        ) : cardsError ? (
          <div className="space-y-3 py-10">
            <p className="text-center text-[17px] text-primary">
              {firstPlaceError instanceof Error
                ? firstPlaceError.message
                : "장소 정보를 불러오지 못했습니다."}
            </p>
            <div className="text-center">
              <button
                type="button"
                onClick={retryPlacePreviews}
                className="cursor-pointer text-[17px] font-medium text-neutral-900 underline"
              >
                다시 시도
              </button>
            </div>
          </div>
        ) : places.length === 0 ? (
          <p className="py-10 text-center text-[17px] text-dark-gray">
            담긴 장소가 없습니다.
          </p>
        ) : (
          places.map((row) => (
            <BookmarkPlaceRow
              key={row.id}
              place={row}
              roomId={roomId}
              currentCategoryId={categoryIdOk}
              onOpenDetail={() => {
                setSelectedPlace(
                  {
                    name: row.name,
                    category: "",
                    rating: null,
                    address: row.address,
                    googlePlaceId: row.googlePlaceId,
                    location: row.location,
                    fromBookmark: true,
                    bookmarkCategoryColor: folder.color,
                  },
                  { itinerarySource: "bookmark" },
                );
              }}
            />
          ))
        )}
      </div>
    </>
  );
}
