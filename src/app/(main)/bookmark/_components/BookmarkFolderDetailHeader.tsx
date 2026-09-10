"use client";

import { SquarePen } from "lucide-react";
import Link from "next/link";

import {
  pageToolbarButtonCompactGapClass,
  pageToolbarButtonCompactPaddingClass,
  pageToolbarButtonCompactTextClass,
} from "@/components/layout/page-toolbar-button";
import { MainPageHeader } from "@/components/layout/MainPageHeader";
import { cn } from "@/lib/utils";
import type { BookmarkFolder } from "@/types/bookmark";

import { BOOKMARK_LIST_PATH } from "../routes";
import { FolderRibbonIcon } from "./FolderRibbonIcon";

export function BookmarkFolderDetailHeader({
  folder,
  onEditClick,
}: {
  folder: BookmarkFolder;
  onEditClick?: () => void;
}) {
  return (
    <div className="shrink-0 border-b border-gray-border pb-5">
      <MainPageHeader
        className="items-center"
        title={
          <span className="flex min-w-0 items-center gap-2 mobile:text-[17px]">
            <FolderRibbonIcon
              color={folder.color}
              variant="header"
              className="size-7 mobile:size-5"
            />
            <span className="min-w-0 truncate">{folder.title}</span>
            <span className="shrink-0 text-[14px] font-normal text-dark-gray mobile:text-[12px]">
              {folder.placeCount ?? 0}개 장소
            </span>
          </span>
        }
        action={
          <>
            {onEditClick ? (
              <button
                type="button"
                onClick={onEditClick}
                className="shrink-0 cursor-pointer rounded-lg p-1 text-neutral-700 transition-colors hover:bg-bubble-gray"
                aria-label="장소 목록 편집"
              >
                <SquarePen className="size-5" strokeWidth={2} />
              </button>
            ) : null}
            <Link
              href={BOOKMARK_LIST_PATH}
              className={cn(
                "flex w-fit shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm transition-opacity hover:opacity-95 active:opacity-90",
                pageToolbarButtonCompactGapClass,
                pageToolbarButtonCompactTextClass,
                pageToolbarButtonCompactPaddingClass,
              )}
            >
              목록으로 돌아가기
            </Link>
          </>
        }
      />
    </div>
  );
}
