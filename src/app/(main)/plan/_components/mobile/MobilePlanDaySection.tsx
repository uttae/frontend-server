"use client";

import { useState } from "react";

import {
  ArrowSortIcon,
  CalendarAddIcon,
  CoinIcon,
  SettingsIcon,
  TrashIcon,
} from "@/assets/icons";
import { useExpenseContext } from "@/components/expenses/ExpenseProvider";
import {
  MobileBottomSheet,
  MobileSheetMenuItem,
} from "@/components/mobile/MobileBottomSheet";
import { expensesInScope } from "@/lib/expenses/expense-scope";
import { summarizeExpensesForMobile } from "@/lib/plan/mobilePlanFormat";
import type { PlanPlace } from "@/lib/plan/types";

import { MobilePlanItinerary } from "./MobilePlanItinerary";

type MobilePlanDaySectionProps = Readonly<{
  roomId: string;
  scheduleId: number;
  /** `1일차` */
  dayLabel: string;
  /** `09. 21 수` */
  dateLabel: string;
  /** `9월 21일` — 방문 시간 시트에 표시 */
  monthDayLabel: string;
  menuDisabled: boolean;
  /** 순서 편집 모드 — 모든 일차가 함께 들어가고 나온다 */
  editing: boolean;
  onStartEditing: () => void;
  onFinishEditing: () => void;
  onRequestInsertDayAfter: () => void;
  onRequestDeleteDay: () => void;
  onRequestAddPlace: (scheduleId: number, places: PlanPlace[]) => void;
}>;

/** 모바일 일차 한 개 — 헤더(순서 편집 ↑↓ / ⚙ 일정 관리)와 장소 목록 */
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
}: MobilePlanDaySectionProps) {
  const expenses = useExpenseContext();
  const [manageOpen, setManageOpen] = useState(false);

  const dayExpenses = expensesInScope(expenses.list.data ?? [], { scheduleId, label: dayLabel });
  const dayExpenseSummary = summarizeExpensesForMobile(dayExpenses);

  function openDayExpenses() {
    setManageOpen(false);
    if (dayExpenses.length === 0) expenses.open({ scheduleId });
    else expenses.openScope({ scheduleId, label: dayLabel, subtitle: dateLabel });
  }

  return (
    <section aria-label={`${dayLabel} ${dateLabel}`} className="flex flex-col gap-3.5 px-4 pb-6 pt-5">
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-title-l text-text">{dayLabel}</h2>
        {dateLabel ? <span className="text-body-m-emphasis text-text-subtle">{dateLabel}</span> : null}
        <div className="ml-auto flex items-center gap-1.5">
          {editing ? (
            <button
              type="button"
              onClick={onFinishEditing}
              className="flex h-9 items-center px-1.5 text-label-m-emphasis text-primary"
            >
              저장
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onStartEditing}
                aria-label={`${dayLabel} 장소 순서 편집`}
                className="flex size-9 items-center justify-center"
              >
                <ArrowSortIcon className="text-icon" />
              </button>
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                disabled={menuDisabled}
                aria-label={`${dayLabel} 일정 관리`}
                className="flex size-9 items-center justify-center disabled:opacity-40"
              >
                <SettingsIcon className="text-icon" />
              </button>
            </>
          )}
        </div>
      </div>

      <MobilePlanItinerary
        roomId={roomId}
        scheduleId={scheduleId}
        monthDayLabel={monthDayLabel}
        onRequestAddPlace={(places) => onRequestAddPlace(scheduleId, places)}
      />

      <MobileBottomSheet open={manageOpen} onClose={() => setManageOpen(false)} title="일정 관리">
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
      </MobileBottomSheet>
    </section>
  );
}
