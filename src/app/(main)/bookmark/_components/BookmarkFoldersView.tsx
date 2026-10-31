"use client";

import { BookmarkPlus, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useRef, useState } from "react";

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
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { BookmarkListSkeleton } from "./BookmarkListSkeleton";
import { FolderRibbonIcon } from "./FolderRibbonIcon";

export function BookmarkFoldersView() {
  const roomId = useSessionStore((s) => s.currentRoomId);
  const { folders } = useBookmarkFolders();
  useAllRoomBookmarks(roomId);
  const { isPending, isLoadingError, error, refetch } =
    useBookmarkCategories(roomId);
  const { mutate: createCategory, isPending: isCreating } =
    useCreateBookmarkCategory();
  const {
    mutate: deleteCategory,
    isPending: isDeleting,
    variables: deleteVariables,
  } = useDeleteBookmarkCategory();
  const [folderToDelete, setFolderToDelete] = useState<{
    categoryId: number;
    title: string;
  } | null>(null);
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
  const [folderFormError, setFolderFormError] = useState<string | null>(null);
  // 편집 대화상자는 메뉴 항목에서 열려 닫힌 뒤 돌아갈 항목이 없다. 마지막으로 연 행 메뉴 버튼으로 포커스를 돌려준다
  const menuTriggerRef = useRef<HTMLElement | null>(null);

  const openCreate = () => {
    setFolderFormError(null);
    setModalKey((k) => k + 1);
    setModalMode("create");
    setEditingFolder(null);
    setModalOpen(true);
  };

  const openEdit = (folder: BookmarkFolder) => {
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
          trackAnalyticsEvent(AnalyticsEvents.createBookmarkFolder, {
            room_id: roomId,
          });
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

    setFolderToDelete({ categoryId, title: folder.title });
  };

  const handleConfirmDelete = () => {
    if (!roomId || !folderToDelete) return;
    deleteCategory(
      { roomId, categoryId: folderToDelete.categoryId },
      {
        onSuccess: () => {
          setFolderToDelete(null);
          toast.success("북마크 목록을 삭제했어요.");
        },
      },
    );
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
      disabled={isPending || isCreating || isUpdating}
      className={cn(
        "flex w-fit shrink-0 cursor-pointer items-center rounded-full bg-primary text-white shadow-sm transition-opacity hover:opacity-95 active:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
        pageToolbarButtonCompactGapClass,
        pageToolbarButtonCompactTextClass,
        pageToolbarButtonCompactPaddingClass,
      )}
    >
      <BookmarkPlus
        className={pageToolbarButtonCompactIconClass}
        strokeWidth={pageToolbarButtonCompactIconStroke}
      />
      새 북마크 생성
    </button>
  );

  if (!roomId) {
    return <MainPageHeader title="북마크" />;
  }

  if (isPending) {
    return (
      <div className="space-y-2.5">
        <MainPageHeader title="북마크" action={createAction} />
        <BookmarkListSkeleton />
      </div>
    );
  }

  // 재조회 실패는 보이던 폴더를 지우지 않는다 — 처음 불러오기에 실패했을 때만 오류 화면
  if (isLoadingError) {
    return (
      <div className="space-y-2.5">
        <MainPageHeader title="북마크" />
        <div className="space-y-3 py-10 text-center">
          <p className="text-body-m-regular mobile:text-body-s-regular text-primary">
            {error instanceof Error
              ? error.message
              : "목록을 불러오지 못했습니다."}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="cursor-pointer text-label-l-regular mobile:text-label-m-regular font-medium text-neutral-900 underline"
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
              "py-10 text-center text-body-m-regular mobile:text-body-s-regular text-dark-gray",
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
                      <p className="truncate text-body-l-emphasis mobile:text-body-m-emphasis font-medium text-neutral-900">
                        {folder.title}
                      </p>
                      <p className="mt-0.5 text-body-m-regular mobile:text-body-s-regular text-dark-gray">
                        {folder.placeCount ?? 0}개 장소
                      </p>
                    </div>
                  </Link>
                  <DropdownMenu
                    onOpenChange={(open, { trigger }) => {
                      if (open && trigger instanceof HTMLElement) menuTriggerRef.current = trigger;
                    }}
                  >
                    <DropdownMenuTrigger
                      disabled={rowMenuBusy(folder.id)}
                      className="shrink-0 cursor-pointer rounded-lg p-2 text-dark-gray transition-colors hover:bg-bubble-gray disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="메뉴"
                    >
                      <MoreHorizontal className="size-5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {/* 진행 중에는 항목을 비활성으로만 둔다(메뉴 항목은 Button이 아니라 progress가 없다) */}
                      <DropdownMenuItem
                        disabled={rowMenuBusy(folder.id)}
                        onClick={() => openEdit(folder)}
                      >
                        편집
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={rowMenuBusy(folder.id)}
                        onClick={() => handleDelete(folder)}
                      >
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
          finalFocus={modalMode === "edit" ? menuTriggerRef : undefined}
        />
      )}
      {folderToDelete ? (
        <ConfirmDialog
          destructive
          title={`「${folderToDelete.title}」 북마크 목록을 삭제할까요?`}
          description="소속 북마크 항목도 함께 삭제됩니다."
          confirmLabel="삭제"
          isPending={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setFolderToDelete(null)}
        />
      ) : null}
    </div>
  );
}
