"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useBookmarkCategories } from "@/hooks/useRooms";
import type { BookmarkCategory } from "@/lib/api/rooms";
import { useSessionStore } from "@/stores/session-store";
import type { BookmarkFolder } from "@/types/bookmark";

type BookmarkFoldersContextValue = {
  folders: BookmarkFolder[];
};

const BookmarkFoldersContext = createContext<BookmarkFoldersContextValue | null>(null);

function categoryToFolder(c: BookmarkCategory): BookmarkFolder {
  return {
    id: String(c.categoryId),
    title: c.name,
    color: c.colorCode,
    placeCount: c.placeCount,
  };
}

export function BookmarkFoldersProvider({ children }: { children: ReactNode }) {
  const roomId = useSessionStore((s) => s.currentRoomId);
  const { data } = useBookmarkCategories(roomId);

  const folders = useMemo<BookmarkFolder[]>(() => {
    if (!roomId || !data) return [];
    return data.map(categoryToFolder);
  }, [data, roomId]);

  const value = useMemo(() => ({ folders }), [folders]);
  return <BookmarkFoldersContext.Provider value={value}>{children}</BookmarkFoldersContext.Provider>;
}

export function useBookmarkFolders() {
  const ctx = useContext(BookmarkFoldersContext);
  if (!ctx) {
    throw new Error("useBookmarkFolders must be used under BookmarkFoldersProvider");
  }
  return ctx;
}
