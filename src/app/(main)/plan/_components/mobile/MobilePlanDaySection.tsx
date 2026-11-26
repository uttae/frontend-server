"use client";

import { useState } from "react";

import { ArrowSortIcon, CalendarAddIcon, CoinIcon, SettingsIcon, TrashIcon } from "@/assets/icons";
import { useExpenseContext } from "@/components/expenses/ExpenseProvider";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { expensesInScope } from "@/lib/expenses/expense-scope";
import type { InsertAnchor } from "@/lib/plan/insertPosition";
import { summarizePlaceExpenses } from "@/lib/plan/mobilePlanFormat";

import { MobilePlanItinerary } from "./MobilePlanItinerary";
import { MobileSheetMenuItem } from "./MobileSheetMenuItem";

type MobilePlanDaySectionProps = Readonly<{
  roomId: string;
  scheduleId: number;
  dayLabel: string;
  dateLabel: string;
  monthDayLabel: string;
  menuDisabled: boolean;
  editing: boolean;
  onStartEditing: () => void;
  onFinishEditing: () => void;
  onRequestInsertDayAfter: () => void;
  onRequestDeleteDay: () => void;
  onRequestAddPlace: (scheduleId: number, anchor: InsertAnchor | null) => void;
  recentlyAddedItemId: number | null;
  onPlaceAdded: (itemId: number) => void;
}>;

export function MobilePlanDaySection({
  roomId,
  scheduleId,
  dayLabel,
  dateLabel,
  monthDayLabel,
  menuDisabled,
  editing,
  onStartEditing,
  onFinishEditing,
  onRequestInsertDayAfter,
  onRequestDeleteDay,
  onRequestAddPlace,
  recentlyAddedItemId,
  onPlaceAdded,
}: MobilePlanDaySectionProps) {
  const expenses = useExpenseContext();
  const [manageOpen, setManageOpen] = useState(false);

  const dayExpenses = expensesInScope(expenses.list.data ?? [], { scheduleId, label: dayLabel });
  const dayExpenseSummary = summarizePlaceExpenses(dayExpenses);

  function openDayExpenses() {
    setManageOpen(false);
    if (dayExpenses.length === 0) expenses.open({ scheduleId });
    else expenses.openScope({ scheduleId, label: dayLabel, subtitle: dateLabel });
  }

  return (
    <section aria-label={`${dayLabel} ${dateLabel}`} className="flex flex-col px-5 pb-5">
      <div className="flex items-center gap-2 py-3">
        <h2 className="text-title-l text-text">{dayLabel}</h2>
        {dateLabel ? <span className="text-label-l-emphasis text-text-subtle">{dateLabel}</span> : null}
        <div className="ml-auto flex items-center">
          {editing ? (
            <button
              type="button"
              onClick={onFinishEditing}
              className="flex h-10 items-center px-1.5 text-label-m-emphasis text-primary"
            >
              저장
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onStartEditing}
                aria-label={`${dayLabel} 장소 순서 편집`}
                className="flex size-10 items-center justify-center"
              >
                <ArrowSortIcon className="text-icon-subtle" />
              </button>
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                disabled={menuDisabled}
                aria-label={`${dayLabel} 일정 관리`}
                className="flex size-10 items-center justify-center disabled:opacity-40"
              >
                <SettingsIcon className="text-icon-subtle" />
              </button>
            </>
          )}
        </div>
      </div>

      <MobilePlanItinerary
        roomId={roomId}
        scheduleId={scheduleId}
        monthDayLabel={monthDayLabel}
        onRequestAddPlace={(anchor) => onRequestAddPlace(scheduleId, anchor)}
        recentlyAddedItemId={recentlyAddedItemId}
        onPlaceAdded={onPlaceAdded}
      />

      <Drawer open={manageOpen} onOpenChange={setManageOpen}>
        <DrawerContent closeLabel="일정 관리 닫기">
          <DrawerHeader>
            <DrawerTitle>일정 관리</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="gap-2">
            <MobileSheetMenuItem
              icon={CalendarAddIcon}
              label="일차 추가"
              disabled={menuDisabled}
              onClick={() => {
                setManageOpen(false);
                onRequestInsertDayAfter();
              }}
            />
            <MobileSheetMenuItem
              icon={TrashIcon}
              label="일차 삭제"
              danger
              disabled={menuDisabled}
              onClick={() => {
                setManageOpen(false);
                onRequestDeleteDay();
              }}
            />
            {expenses.canManage ? (
              <>
                <hr className="my-1 shrink-0 border-border-subtle" />
                <MobileSheetMenuItem
                  icon={CoinIcon}
                  label="비용"
                  disabled={expenses.busy}
                  onClick={openDayExpenses}
                  trailing={
                    dayExpenseSummary ? (
                      <span className="flex items-center justify-end gap-1 text-body-s-regular tabular-nums text-text-subtle">
                        <CoinIcon size={18} className="shrink-0 text-icon-subtle" />
                        <span className="truncate">{dayExpenseSummary}</span>
                      </span>
                    ) : null
                  }
                />
              </>
            ) : null}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </section>
  );
}
