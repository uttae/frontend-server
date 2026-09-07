"use client";

import { BookmarkPlus, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { MAIN_CARD_INNER_PADDING_X_CLASS } from "@/lib/layout-tokens";
import { messageForBookmarkCategorySaveError } from "@/lib/api/errors";
import {
  pageToolbarButtonCompactGapClass,
  pageToolbarButtonCompactIconClass,
  pageToolbarButtonCompactIconStroke,
  pageToolbarButtonCompactPaddingClass,
  pageToolbarButtonCompactTextClass,
} from "@/components/layout/page-toolbar-button";
import { MainPageHeader } from "@/components/layout/MainPageHeader";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import { pickUniqueUntitledBookmarkCategoryName } from "@/lib/bookmark-untitled-category-name";
import {
  useAllRoomBookmarks,
  useBookmarkCategories,
  useCreateBookmarkCategory,
  useDeleteBookmarkCategory,
  useUpdateBookmarkCategory,
} from "@/hooks/useRooms";
import { useSessionStore } from "@/stores/session-store";
import { cn } from "@/lib/utils";
import type { BookmarkFolder } from "@/types/bookmark";
import { useBookmarkFolders } from "../context";
import { bookmarkFolderPath } from "../routes";
import { AddBookmarkModal } from "./AddBookmarkModal";
import { FolderRibbonIcon } from "./FolderRibbonIcon";

export function BookmarkFoldersView() {
  const roomId = useSessionStore((s) => s.currentRoomId);
  const { folders } = useBookmarkFolders();
  useAllRoomBookmarks(roomId);
  const { isPending, isError, error, refetch } = useBookmarkCategories(roomId);
  const { mutate: createCategory, isPending: isCreating } =
    useCreateBookmarkCategory();
  const {
    mutate: deleteCategory,
    isPending: isDeleting,
    variables: deleteVariables,
  } = useDeleteBookmarkCategory();
  const {
    mutate: updateCategory,
    isPending: isUpdating,
    variables: updateVariables,
  } = useUpdateBookmarkCategory();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingFolder, setEditingFolder] = useState<BookmarkFolder | null>(
    null,
  );
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [folderFormError, setFolderFormError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setMenuOpenId(null), []);

  useEffect(() => {
    if (!menuOpenId) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) closeMenu();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [menuOpenId, closeMenu]);

  const openCreate = () => {
    setFolderFormError(null);
    setModalKey((k) => k + 1);
    setModalMode("create");
    setEditingFolder(null);
    setModalOpen(true);
  };

  const openEdit = (folder: BookmarkFolder) => {
    closeMenu();
    setFolderFormError(null);
    setModalKey((k) => k + 1);
    setModalMode("edit");
    setEditingFolder(folder);
    setModalOpen(true);
  };

  const handleSave = ({ title, color }: { title: string; color: string }) => {
    if (!roomId) return;
    setFolderFormError(null);
    if (modalMode === "edit" && editingFolder) {
      const categoryId = Number.parseInt(editingFolder.id, 10);
      if (!Number.isFinite(categoryId)) return;
      const peerTitles = folders
        .filter((f) => f.id !== editingFolder.id)
        .map((f) => f.title);
      const resolvedName = title.trim()
        ? title.trim()
        : pickUniqueUntitledBookmarkCategoryName(peerTitles);
      updateCategory(
        { roomId, categoryId, name: resolvedName, colorCode: color },
        {
          onSuccess: () => {
            setModalOpen(false);
            setEditingFolder(null);
          },
          onError: (e) => {
            setFolderFormError(
              messageForBookmarkCategorySaveError(
                e,
                "북마크를 수정하지 못했습니다.",
              ),
            );
          },
        },
      );
      return;
    }
    const resolvedName = title.trim()
      ? title.trim()
      : pickUniqueUntitledBookmarkCategoryName(folders.map((f) => f.title));
    createCategory(
      { roomId, name: resolvedName, colorCode: color },
      {
        onSuccess: () => {
          trackAnalyticsEvent(AnalyticsEvents.createBookmarkFolder);
          setModalOpen(false);
        },
        onError: (e) => {
          setFolderFormError(
            messageForBookmarkCategorySaveError(
              e,
              "북마크를 추가하지 못했습니다.",
            ),
          );
        },
      },
    );
  };

  const handleDelete = (folder: BookmarkFolder) => {
    if (!roomId) return;
    const categoryId = Number.parseInt(folder.id, 10);
    if (!Number.isFinite(categoryId)) return;

    const ok = window.confirm(
      `「${folder.title}」 카테고리를 삭제할까요? 소속 북마크 항목도 함께 삭제됩니다.`,
    );
    if (!ok) return;

    closeMenu();
    deleteCategory({ roomId, categoryId });
  };

  const isRowDeleting = (folderId: string) =>
    isDeleting &&
    deleteVariables != null &&
    String(deleteVariables.categoryId) === folderId;

  const isRowUpdating = (folderId: string) =>
    isUpdating &&
    updateVariables != null &&
    String(updateVariables.categoryId) === folderId;

  const rowMenuBusy = (folderId: string) =>
    isRowDeleting(folderId) || isRowUpdating(folderId);

  const createAction = (
    <button
      type="button"
      onClick={openCreate}
      disabled={isCreating || isUpdating}
      className={cn(
        "flex w-fit shrink-0 cursor-pointer items-center rounded-full bg-primary text-white shadow-sm transition-opacity hover:opacity-95 active:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 mobile:hidden",
        pageToolbarButtonCompactGapClass,
        pageToolbarButtonCompactTextClass,
        pageToolbarButtonCompactPaddingClass,
      )}
    >
      <BookmarkPlus
        className={pageToolbarButtonCompactIconClass}
        strokeWidth={pageToolbarButtonCompactIconStroke}
      />
      새 북마크 추가
    </button>
  );

  if (!roomId) {
    return <MainPageHeader title="북마크" />;
  }

  if (isPending) {
    return (
      <div className="space-y-2.5">
        <MainPageHeader title="북마크" />
        <div className="py-10 text-center text-[17px] text-dark-gray">
          불러오는 중…
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-2.5">
        <MainPageHeader title="북마크" />
        <div className="space-y-3 py-10 text-center">
          <p className="text-[17px] text-primary">
            {error instanceof Error
              ? error.message
              : "목록을 불러오지 못했습니다."}
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

  return (
    <div className="space-y-2.5 pb-8">
      <MainPageHeader title="북마크" action={createAction} />

      <div className="rounded-2xl border border-gray-border bg-white">
        {folders.length === 0 ? (
          <p
            className={cn(
              "py-10 text-center text-[17px] text-dark-gray",
              MAIN_CARD_INNER_PADDING_X_CLASS,
            )}
          >
            북마크가 없습니다. 위 버튼으로 추가해 보세요.
          </p>
        ) : (
          <ul className="divide-y divide-gray-border">
            {folders.map((folder) => (
              <li key={folder.id}>
                <div
                  className={cn(
                    "flex items-center gap-3 py-4",
                    MAIN_CARD_INNER_PADDING_X_CLASS,
                  )}
                >
                  <Link
                    href={bookmarkFolderPath(folder.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none ring-primary focus-visible:ring-2"
                  >
                    <FolderRibbonIcon color={folder.color} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-medium text-neutral-900">
                        {folder.title}
                      </p>
                      <p className="mt-0.5 text-[17px] text-dark-gray">
                        {folder.placeCount ?? 0}개 장소
                      </p>
                    </div>
                  </Link>
                  <div
                    className="relative shrink-0"
                    ref={menuOpenId === folder.id ? menuRef : null}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setMenuOpenId((id) =>
                          id === folder.id ? null : folder.id,
                        )
                      }
                      disabled={rowMenuBusy(folder.id)}
                      className="cursor-pointer rounded-lg p-2 text-dark-gray transition-colors hover:bg-bubble-gray disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="메뉴"
                    >
                      <MoreHorizontal className="size-5" />
                    </button>
                    {menuOpenId === folder.id && (
                      <div
                        className="absolute right-0 top-full z-20 mt-1 min-w-[120px] overflow-hidden rounded-xl border border-gray-border bg-white py-1 shadow-lg"
                        role="menu"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full cursor-pointer px-4 py-2 text-left text-[17px] text-neutral-900 hover:bg-bubble-gray disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={
                            isRowDeleting(folder.id) || isRowUpdating(folder.id)
                          }
                          onClick={() => openEdit(folder)}
                        >
                          {isRowUpdating(folder.id) ? "편집 중…" : "편집"}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full cursor-pointer px-4 py-2 text-left text-[17px] text-status-negative hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={
                            isRowDeleting(folder.id) || isRowUpdating(folder.id)
                          }
                          onClick={() => handleDelete(folder)}
                        >
                          {isRowDeleting(folder.id) ? "삭제 중…" : "삭제"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalOpen && (
        <AddBookmarkModal
          key={modalKey}
          mode={modalMode}
          initialFolder={editingFolder}
          busy={modalMode === "edit" ? isUpdating : isCreating}
          untitledNameHint={pickUniqueUntitledBookmarkCategoryName(
            modalMode === "edit" && editingFolder
              ? folders
                  .filter((f) => f.id !== editingFolder.id)
                  .map((f) => f.title)
              : folders.map((f) => f.title),
          )}
          onClose={() => {
            setModalOpen(false);
            setEditingFolder(null);
            setFolderFormError(null);
          }}
          onSave={handleSave}
          formError={folderFormError}
        />
      )}
    </div>
  );
}
