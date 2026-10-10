"use client";

import { toast } from "sonner";

import {
  CoinIcon,
  LocationAddIcon,
  SavedAddIcon,
  TimeClockIcon,
  TrashIcon,
  WriteAddIcon,
  WriteIcon,
} from "@/assets/icons";
import { useExpenseContext } from "@/components/expenses/ExpenseProvider";
import { MobileBottomSheet, MobileSheetMenuItem } from "@/components/mobile/MobileBottomSheet";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { useDeleteScheduleItem } from "@/hooks/useRooms";
import { bucketItemCount } from "@/lib/analytics/context";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import { expensesInScope } from "@/lib/expenses/expense-scope";
import { insertAnchorAfterItem, resolveInsertIndex, type InsertAnchor } from "@/lib/plan/insertPosition";
import type { PlanPlace } from "@/lib/plan/types";

import { AddFromBookmarkModal } from "../itinerary/AddFromBookmarkModal";
import { MobileMemoSheet } from "./MobileMemoSheet";
import { MobileTimeSheet } from "./MobileTimeSheet";

/** 장소 카드에서 여는 시트 — 일정 관리 메뉴와 그 안의 메모·시간·삭제, 북마크에서 추가 */
export type MobilePlanPlaceSheet =
  | { kind: "actions" | "memo" | "time" | "delete"; place: PlanPlace }
  /** anchor: 장소 사이에 넣을 기준, null이면 맨 뒤 */
  | { kind: "bookmark"; anchor: InsertAnchor | null };

type ExpenseContextValue = ReturnType<typeof useExpenseContext>;

/** 카드의 비용 줄 — 비용이 없으면 바로 추가, 있으면 그 장소의 비용 목록을 연다 */
export function openPlaceExpenses(expenses: ExpenseContextValue, scheduleId: number, place: PlanPlace) {
  if (typeof place.itemId !== "number") return;
  const scoped = expensesInScope(expenses.list.data ?? [], { scheduleId, scheduleItemId: place.itemId, label: "" });
  if (scoped.length === 0) expenses.open({ scheduleId, scheduleItemId: place.itemId });
  else expenses.openScope({ scheduleId, scheduleItemId: place.itemId, label: place.title });
}

/**
 * 모바일 장소 카드의 시트들 — 일정 목록과 지도 경로 보기가 함께 쓴다.
 * "일정 추가"(검색)는 검색 화면이 상위에 있어 `onInsertFromSearch`로 넘긴다.
 */
export function MobilePlanPlaceSheets({
  roomId,
  scheduleId,
  places,
  monthDayLabel,
  sheet,
  onChangeSheet,
  canInsert,
  onInsertFromSearch,
  onPlaceAdded,
}: Readonly<{
  roomId: string;
  scheduleId: number;
  /** 이 일차의 장소(최신) — 삽입 위치를 정하고 삭제 분석 이벤트에 쓴다 */
  places: PlanPlace[];
  /** `9월 21일` — 방문 시간 시트에 표시 */
  monthDayLabel?: string;
  sheet: MobilePlanPlaceSheet | null;
  onChangeSheet: (sheet: MobilePlanPlaceSheet | null) => void;
  /** 이 장소 바로 뒤에 장소를 넣는 메뉴를 보일지 */
  canInsert: boolean;
  onInsertFromSearch: (anchor: InsertAnchor) => void;
  onPlaceAdded: (itemId: number) => void;
}>) {
  const expenses = useExpenseContext();
  const { mutateAsync: removeItem, isPending: isRemoving } = useDeleteScheduleItem();
  const close = () => onChangeSheet(null);

  if (!sheet) return null;

  if (sheet.kind === "bookmark") {
    return (
      <AddFromBookmarkModal
        roomId={roomId}
        scheduleId={scheduleId}
        places={places}
        // places가 최신 목록이라 렌더마다 다시 계산하면 그사이 바뀐 순서도 반영된다
        insertIndex={resolveInsertIndex(places, sheet.anchor)}
        onAdded={(item) => onPlaceAdded(item.itemId)}
        onClose={close}
      />
    );
  }

  const { place } = sheet;
  const itemId = typeof place.itemId === "number" ? place.itemId : null;

  async function handleDelete() {
    if (itemId === null) return;
    try {
      await removeItem({ roomId, scheduleId, itemId });
      trackAnalyticsEvent(AnalyticsEvents.removeFromItinerary, {
        item_count_bucket: bucketItemCount(places.length - 1),
      });
      toast.success("일정에서 삭제했어요.");
      close();
    } catch {
      toast.error("삭제하지 못했어요.");
    }
  }

  if (sheet.kind === "memo" && itemId !== null) {
    return (
      <MobileMemoSheet
        roomId={roomId}
        scheduleId={scheduleId}
        itemId={itemId}
        placeName={place.title}
        memo={place.memo ?? ""}
        onClose={close}
      />
    );
  }

  if (sheet.kind === "time" && itemId !== null) {
    return (
      <MobileTimeSheet
        roomId={roomId}
        scheduleId={scheduleId}
        itemId={itemId}
        placeName={place.title}
        dateLabel={monthDayLabel}
        startTime={place.startTime}
        endTime={place.endTime}
        onClose={close}
      />
    );
  }

  if (sheet.kind === "delete") {
    return (
      <ConfirmDialog
        title="일정에서 이 장소를 삭제할까요?"
        description="이 장소와 연결된 모든 비용도 함께 삭제돼요."
        confirmLabel="삭제"
        isPending={isRemoving}
        onConfirm={() => void handleDelete()}
        onCancel={close}
      />
    );
  }

  if (sheet.kind !== "actions") return null;

  return <PlaceActionsMenu place={place} itemId={itemId} canInsert={canInsert}
    places={places} scheduleId={scheduleId} expenses={expenses} close={close}
    onInsertFromSearch={onInsertFromSearch} onChangeSheet={onChangeSheet} />;
}

function PlaceActionsMenu({ place, itemId, canInsert, places, scheduleId, expenses,
  close, onInsertFromSearch, onChangeSheet }: Readonly<{
  place: PlanPlace;
  itemId: number | null;
  canInsert: boolean;
  places: PlanPlace[];
  scheduleId: number;
  expenses: ExpenseContextValue;
  close: () => void;
  onInsertFromSearch: (anchor: InsertAnchor) => void;
  onChangeSheet: (sheet: MobilePlanPlaceSheet | null) => void;
}>) {
  return (
    <MobileBottomSheet open onClose={close} title={place.title}>
      {itemId === null ? (
        <p className="py-2 text-body-s-regular text-text-subtle">
          아직 저장 중인 장소예요. 잠시 후 다시 시도해 주세요.
        </p>
      ) : (
        <>
          {canInsert ? (
            <>
              <MobileSheetMenuItem
                icon={LocationAddIcon}
                label="일정 추가"
                onClick={() => {
                  close();
                  onInsertFromSearch(insertAnchorAfterItem(places, itemId));
                }}
              />
              <MobileSheetMenuItem
                icon={SavedAddIcon}
                label="북마크에서 추가"
                onClick={() =>
                  onChangeSheet({ kind: "bookmark", anchor: insertAnchorAfterItem(places, itemId) })
                }
              />
              <hr className="my-1 shrink-0 border-border-subtle" />
            </>
          ) : null}
          <MobileSheetMenuItem
            icon={place.memo?.trim() ? WriteIcon : WriteAddIcon}
            label={place.memo?.trim() ? "메모 수정" : "메모 추가"}
            onClick={() => onChangeSheet({ kind: "memo", place })}
          />
          <MobileSheetMenuItem
            icon={TimeClockIcon}
            label="시간 설정"
            onClick={() => onChangeSheet({ kind: "time", place })}
          />
          {expenses.canManage ? (
            <MobileSheetMenuItem
              icon={CoinIcon}
              label="비용 추가"
              disabled={expenses.busy}
              onClick={() => {
                close();
                expenses.open({ scheduleId, scheduleItemId: itemId });
              }}
            />
          ) : null}
          <MobileSheetMenuItem
            icon={TrashIcon}
            label="일정 삭제"
            danger
            onClick={() => onChangeSheet({ kind: "delete", place })}
          />
        </>
      )}
    </MobileBottomSheet>
  );
}
