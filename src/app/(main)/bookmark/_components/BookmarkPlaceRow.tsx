"use client";

import { ChevronLeft, MoreHorizontal } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { BookmarkPlacePreviewCard } from "./BookmarkPlacePreviewCard";
import {
  useBookmarkCategories,
  useDeleteRoomBookmarkItem,
  useMoveRoomBookmark,
} from "@/hooks/useRooms";
import type { BookmarkedPlace } from "@/types/bookmark";

type MenuPhase = "main" | "pickCategory";

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

const MENU_GAP_PX = 4;
const MENU_WIDTH_PX = 184;
const MENU_MAX_HEIGHT_PX = 352;
const MENU_VIEWPORT_PADDING_PX = 8;

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
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  const { data: categories } = useBookmarkCategories(roomId);
  const { mutate: moveBookmark, isPending: moving } = useMoveRoomBookmark();
  const { mutate: deleteItem, isPending: deleting } =
    useDeleteRoomBookmarkItem();

  const busy = moving || deleting;
  const otherCategories =
    categories?.filter((c) => c.categoryId !== currentCategoryId) ?? [];

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuPhase("main");
  }, []);

  const updateMenuPosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    if (!triggerEl || !menuOpen) {
      setMenuPosition(null);
      return;
    }
    const rect = triggerEl.getBoundingClientRect();
    const estimatedHeight =
      menuPhase === "main"
        ? 96
        : Math.min(
            64 + Math.max(otherCategories.length, 1) * 40,
            MENU_MAX_HEIGHT_PX,
          );
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow >= estimatedHeight + MENU_GAP_PX
        ? rect.bottom + MENU_GAP_PX
        : Math.max(
            MENU_VIEWPORT_PADDING_PX,
            rect.top - MENU_GAP_PX - estimatedHeight,
          );
    const left = Math.min(
      Math.max(
        MENU_VIEWPORT_PADDING_PX,
        rect.right - MENU_WIDTH_PX,
      ),
      window.innerWidth - MENU_WIDTH_PX - MENU_VIEWPORT_PADDING_PX,
    );
    setMenuPosition({
      top,
      left,
      width: MENU_WIDTH_PX,
    });
  }, [menuOpen, menuPhase, otherCategories.length]);

  useLayoutEffect(() => {
    updateMenuPosition();
  }, [updateMenuPosition, menuPhase]);

  useEffect(() => {
    if (!menuOpen) return;
    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("resize", updateMenuPosition);
    return () => {
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [menuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuPanelRef.current?.contains(target)) return;
      closeMenu();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [menuOpen, closeMenu]);

  const handleMoveTo = (targetCategoryId: number) => {
    if (!Number.isFinite(bookmarkId) || busy) return;
    moveBookmark(
      {
        roomId,
        bookmarkId,
        categoryId: targetCategoryId,
        fromCategoryId: currentCategoryId,
      },
      { onSuccess: () => closeMenu() },
    );
  };

  const handleDelete = () => {
    if (!Number.isFinite(bookmarkId) || busy) return;
    const ok = window.confirm("이 장소를 북마크에서 삭제할까요?");
    if (!ok) return;
    closeMenu();
    deleteItem({ roomId, bookmarkId, categoryId: currentCategoryId });
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
      />
      <div
        className="absolute right-[6.25rem] top-3 z-10 flex"
        ref={triggerRef}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => {
              if (o) {
                setMenuPhase("main");
                return false;
              }
              return true;
            });
          }}
          disabled={busy}
          className={`cursor-pointer rounded-lg p-1 text-dark-gray transition-colors hover:bg-bubble-gray hover:text-neutral-900 active:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 ${
            menuOpen ? "bg-primary/10 text-primary" : ""
          }`}
          aria-label="장소 메뉴"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className="size-5" />
        </button>

        {menuOpen &&
          menuPosition &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={menuPanelRef}
              style={{
                position: "fixed",
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                zIndex: 200,
              }}
              className="animate-in fade-in-0 zoom-in-95 max-h-[22rem] overflow-y-auto rounded-xl border border-gray-border/80 bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.18)] duration-150"
              role="menu"
            >
              {menuPhase === "main" ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-[17px] font-medium text-neutral-900 transition-colors hover:bg-bubble-gray disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busy}
                    onClick={() => setMenuPhase("pickCategory")}
                  >
                    카테고리 변경
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="mt-0.5 block w-full cursor-pointer rounded-lg border-t border-gray-border/70 px-3 py-2.5 text-left text-[17px] font-medium text-status-negative transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={busy}
                    onClick={handleDelete}
                  >
                    {deleting ? "삭제 중…" : "삭제"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-1 rounded-lg px-2.5 py-2 text-left text-[17px] font-medium text-neutral-800 transition-colors hover:bg-bubble-gray"
                    onClick={() => setMenuPhase("main")}
                  >
                    <ChevronLeft className="size-4 shrink-0" />
                    뒤로
                  </button>
                  <div className="mx-1 my-1 border-t border-gray-border" />
                  {otherCategories.length === 0 ? (
                    <p className="rounded-lg bg-gray-50 px-3 py-3 text-center text-[14px] leading-relaxed text-dark-gray">
                      이동할 다른 카테고리가 없습니다.
                    </p>
                  ) : (
                    otherCategories.map((c) => (
                      <button
                        key={c.categoryId}
                        type="button"
                        role="menuitem"
                        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[17px] text-neutral-900 transition-colors hover:bg-bubble-gray disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={busy}
                        onClick={() => handleMoveTo(c.categoryId)}
                      >
                        <span
                          className="size-3 shrink-0 rounded-full border border-black/10"
                          style={{ backgroundColor: c.colorCode }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      </button>
                    ))
                  )}
                </>
              )}
            </div>,
            document.body,
          )}
      </div>
    </div>
  );
}
