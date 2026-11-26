"use client";

import { useRef } from "react";
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
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useDeleteScheduleItem } from "@/hooks/useRooms";
import { bucketItemCount } from "@/lib/analytics/context";
import { AnalyticsEvents, trackAnalyticsEvent } from "@/lib/analytics/track";
import { expensesInScope } from "@/lib/expenses/expense-scope";
import { insertAnchorAfterItem, resolveInsertIndex, type InsertAnchor } from "@/lib/plan/insertPosition";
import type { PlanPlace } from "@/lib/plan/types";

import { AddFromBookmarkModal } from "../itinerary/AddFromBookmarkModal";
import { MobileMemoSheet } from "./MobileMemoSheet";
import { MobileSheetMenuItem } from "./MobileSheetMenuItem";
import { MobileTimeSheet } from "./MobileTimeSheet";

export type MobilePlanPlaceSheet =
  | { kind: "actions" | "memo" | "time" | "delete"; place: PlanPlace }
  | { kind: "bookmark"; anchor: InsertAnchor | null };

type ExpenseContextValue = ReturnType<typeof useExpenseContext>;

export function openPlaceExpenses(expenses: ExpenseContextValue, scheduleId: number, place: PlanPlace) {
  if (typeof place.itemId !== "number") return;
  const scoped = expensesInScope(expenses.list.data ?? [], { scheduleId, scheduleItemId: place.itemId, label: "" });
  if (scoped.length === 0) expenses.open({ scheduleId, scheduleItemId: place.itemId });
  else expenses.openScope({ scheduleId, scheduleItemId: place.itemId, label: place.title });
}

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
  places: PlanPlace[];
  monthDayLabel?: string;
  sheet: MobilePlanPlaceSheet | null;
  onChangeSheet: (sheet: MobilePlanPlaceSheet | null) => void;
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
        insertIndex={resolveInsertIndex(places, sheet.anchor)}
        onAdded={(item) => onPlaceAdded(item.itemId)}
        onClose={close}
      />
    );
  }

  const place = places.find((p) => typeof p.itemId === "number" && p.itemId === sheet.place.itemId) ?? sheet.place;
  const itemId = typeof place.itemId === "number" ? place.itemId : null;

  async function handleDelete() {
    if (itemId === null) return;
    try {
      await removeItem({ roomId, scheduleId, itemId });
      trackAnalyticsEvent(AnalyticsEvents.removeFromItinerary, {
        room_id: roomId,
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
        destructive
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

  return (
    <PlaceActionsMenu
      place={place}
      itemId={itemId}
      canInsert={canInsert}
      places={places}
      scheduleId={scheduleId}
      expenses={expenses}
      close={close}
      onInsertFromSearch={onInsertFromSearch}
      onChangeSheet={onChangeSheet}
    />
  );
}

function PlaceActionsMenu({
  place,
  itemId,
  canInsert,
  places,
  scheduleId,
  expenses,
  close,
  onInsertFromSearch,
  onChangeSheet,
}: Readonly<{
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
  const skipReturnFocus = useRef(false);
  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DrawerContent closeLabel="장소 메뉴 닫기" finalFocus={() => !skipReturnFocus.current}>
        <DrawerHeader>
          <DrawerTitle>{place.title}</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="gap-2">
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
                      skipReturnFocus.current = true;
                      close();
                      onInsertFromSearch(insertAnchorAfterItem(places, itemId));
                    }}
                  />
                  <MobileSheetMenuItem
                    icon={SavedAddIcon}
                    label="북마크에서 추가"
                    onClick={() => onChangeSheet({ kind: "bookmark", anchor: insertAnchorAfterItem(places, itemId) })}
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
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
