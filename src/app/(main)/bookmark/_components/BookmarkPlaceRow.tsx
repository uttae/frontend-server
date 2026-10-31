"use client";

import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { BookmarkPlacePreviewCard } from "./BookmarkPlacePreviewCard";
import {
  useBookmarkCategories,
  useDeleteRoomBookmarkItem,
  useMoveRoomBookmark,
} from "@/hooks/useRooms";
import type { BookmarkedPlace } from "@/types/bookmark";

// '카테고리 변경'은 하위 메뉴 대신 같은 메뉴 안에서 목록으로 바꿔 보인다(지금 화면 흐름 유지, 디자이너 질문으로 남음)
type MenuPhase = "main" | "pickCategory";

export function BookmarkPlaceRow({
  place,
  roomId,
  currentCategoryId,
  onOpenDetail,
}: {
  place: BookmarkedPlace;
  roomId: string;
  currentCategoryId: number;
  onOpenDetail: () => void;
}) {
  const {
    id,
    name,
    address,
    primaryTypeDisplayName,
    googlePlaceId,
  } = place;
  const bookmarkId = Number.parseInt(id, 10);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPhase, setMenuPhase] = useState<MenuPhase>("main");

  const { data: categories } = useBookmarkCategories(roomId);
  const { mutate: moveBookmark, isPending: moving } = useMoveRoomBookmark();
  const { mutate: deleteItem, isPending: deleting } =
    useDeleteRoomBookmarkItem();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const busy = moving || deleting;
  const otherCategories =
    categories?.filter((c) => c.categoryId !== currentCategoryId) ?? [];

  const handleMoveTo = (targetCategoryId: number) => {
    if (!Number.isFinite(bookmarkId) || busy) return;
    moveBookmark(
      {
        roomId,
        bookmarkId,
        categoryId: targetCategoryId,
        fromCategoryId: currentCategoryId,
      },
      // 이동 항목은 누른 뒤에도 메뉴를 열어 두고(closeOnClick={false}) 성공하면 닫는다
      { onSuccess: () => setMenuOpen(false) },
    );
  };

  const handleDelete = () => {
    if (!Number.isFinite(bookmarkId) || busy) return;
    setConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    deleteItem(
      { roomId, bookmarkId, categoryId: currentCategoryId },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          toast.success("북마크에서 삭제했어요.");
        },
      },
    );
  };

  return (
    <div className="relative border-b border-gray-border bg-white">
      <BookmarkPlacePreviewCard
        name={name}
        address={address}
        primaryTypeDisplayName={primaryTypeDisplayName}
        googlePlaceId={googlePlaceId}
        className="min-w-0 w-full border-0 hover:bg-gray-50 active:bg-gray-100"
        contentClassName="pr-7"
        onClick={onOpenDetail}
        onThumbnailClick={onOpenDetail}
      />
      <div className="absolute right-[6.25rem] top-3 z-10 flex">
        <DropdownMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          // 닫힘 애니메이션이 끝난 뒤 첫 단계로 되돌린다(닫히는 동안 내용이 바뀌어 보이지 않게)
          onOpenChangeComplete={(open) => {
            if (!open) setMenuPhase("main");
          }}
        >
          <DropdownMenuTrigger
            disabled={busy}
            className="cursor-pointer rounded-lg p-1 text-dark-gray transition-colors hover:bg-bubble-gray hover:text-neutral-900 active:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 aria-expanded:bg-primary/10 aria-expanded:text-primary"
            aria-label="장소 메뉴"
          >
            <MoreHorizontal className="size-5" />
          </DropdownMenuTrigger>
          {/* 폭 184는 지금 메뉴 값. 높이는 지금 상한 22rem과 화면에 남은 높이 중 작은 쪽 */}
          <DropdownMenuContent align="end" className="w-46 max-h-[min(22rem,var(--available-height))]">
            {menuPhase === "main" ? (
              <>
                <DropdownMenuItem
                  closeOnClick={false}
                  disabled={busy}
                  onClick={() => setMenuPhase("pickCategory")}
                >
                  카테고리 변경
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" disabled={busy} onClick={handleDelete}>
                  삭제
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem closeOnClick={false} onClick={() => setMenuPhase("main")}>
                  <ChevronLeft className="size-4" />
                  뒤로
                </DropdownMenuItem>
                {otherCategories.length === 0 ? (
                  <p className="px-4 py-3 text-center text-body-s-regular mobile:text-body-xs-regular leading-relaxed text-dark-gray">
                    이동할 다른 카테고리가 없습니다.
                  </p>
                ) : (
                  otherCategories.map((c) => (
                    <DropdownMenuItem
                      key={c.categoryId}
                      closeOnClick={false}
                      disabled={busy}
                      onClick={() => handleMoveTo(c.categoryId)}
                    >
                      <span
                        className="size-3 shrink-0 rounded-full border border-black/10"
                        style={{ backgroundColor: c.colorCode }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {confirmOpen ? (
        <ConfirmDialog
          destructive
          title="이 장소를 북마크에서 삭제할까요?"
          confirmLabel="삭제"
          isPending={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      ) : null}
    </div>
  );
}
