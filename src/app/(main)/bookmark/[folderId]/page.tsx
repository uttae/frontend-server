"use client";

import { useParams, notFound } from "next/navigation";
import { useMemo } from "react";
import { SetSectionMaxWidth } from "@/contexts/SectionWidthContext";
import { useBookmarkCategories } from "@/hooks/useRooms";
import { useSessionStore } from "@/stores/session-store";
import { useBookmarkFolders } from "../context";
import { BookmarkFolderDetailView } from "../_components/BookmarkFolderDetailView";

function FolderDetailSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 animate-pulse flex-col border-b border-gray-border"
      aria-busy="true"
      aria-label="북마크 폴더를 불러오는 중"
    >
      <SetSectionMaxWidth value="s1" />
      <div className="flex items-center justify-between border-b border-gray-border pb-5">
        <div className="h-7 w-48 rounded bg-gray-200" />
        <div className="h-9 w-32 rounded-full bg-gray-200" />
      </div>
      <div className="space-y-3 py-5">
        <div className="h-16 rounded-xl bg-gray-200" />
        <div className="h-16 rounded-xl bg-gray-200" />
        <div className="h-16 rounded-xl bg-gray-200" />
      </div>
    </div>
  );
}

export default function BookmarkFolderDetailPage() {
  const params = useParams();
  const folderId = typeof params.folderId === "string" ? params.folderId : "";
  const roomId = useSessionStore((state) => state.currentRoomId);
  const {
    data,
    isPending,
    isError,
    error,
    refetch,
  } = useBookmarkCategories(roomId);
  const { folders } = useBookmarkFolders();

  const folder = useMemo(
    () => folders.find((f) => f.id === folderId),
    [folders, folderId],
  );

  if (!roomId || isPending || (!data && !isError)) {
    return <FolderDetailSkeleton />;
  }

  if (isError && !data) {
    return (
      <div className="flex h-full min-h-0 flex-col border-b border-gray-border">
        <SetSectionMaxWidth value="s1" />
        <div className="space-y-3 py-10 text-center">
          <p className="text-[17px] text-primary">
            {error instanceof Error
              ? error.message
              : "북마크 폴더를 불러오지 못했습니다."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="cursor-pointer text-[17px] font-medium text-neutral-900 underline"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!folderId || !folder) {
    notFound();
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-b border-gray-border">
      <SetSectionMaxWidth value="s1" />
      <BookmarkFolderDetailView folder={folder} />
    </div>
  );
}
