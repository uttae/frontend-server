"use client";
import { ExpenseKrwAmount, ExpenseRateNote, ExpenseRowAmount } from "./ExpenseKrw";
import type { ExpenseKrwSummary } from "@/lib/api/rooms/expenses";
import { expenseTitle } from "@/lib/expenses/expense-name";

import { useId, useState } from "react";
import { ExpensePlaceLabel } from "./ExpensePlaceLabel";
import { ExpenseItemMenu } from "./ExpenseItemMenu";
import { totalsByCurrency } from "@/lib/expenses/expense-scope";
import {
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import {
  expenseCategoryLabel,
  type ExpenseCategory,
  type Expense,
  type ExpenseSummary,
} from "@/lib/api/rooms/expenses";
import type { RoomMember } from "@/lib/api/rooms/types";
import type { RoomSchedule } from "@/lib/api/rooms/schedules";
import {
  expensePerson,
  roleOptions,
  type MemberQueryStatus,
} from "@/lib/expenses/expense-policy";
import { ChatMemberAvatarRing } from "@/components/chat/messages/ChatMemberAvatarRing";

export const expenseButtonClass =
  "min-h-10 rounded-lg border border-gray-border px-3 py-2 text-label-m-emphasis mobile:text-label-s-emphasis font-semibold cursor-pointer transition-colors enabled:hover:border-primary/40 enabled:hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";
export const expenseInputClass =
  "mt-1 min-h-12 w-full min-w-0 rounded-lg border border-border bg-fill-subtle px-3 py-2 text-body-s-regular focus:outline-primary";
// Group the integer string directly so large amounts and trailing decimals stay exact.
import { formatExpenseAmount } from "@/lib/expenses/format-expense-amount";

export { formatExpenseAmount };
const categoryIcons = {
  FLIGHT: "flight",
  ACCOMMODATION: "lodging",
  FOOD: "food",
  TRANSPORT: "transport",
  SHOPPING: "shopping",
  SIGHTSEEING: "sightseeing",
  OTHER: "other",
};
export function CategoryIcon({ category, summary = false }: { category: ExpenseCategory; summary?: boolean }) {
  const asset = categoryIcons[category] ?? "other";
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-fill text-icon ${summary ? "size-9" : "size-8 @min-[800px]/expenses:size-10"}`}>
      <span className="flex size-5 items-center justify-center">
        {/* Figma exports are 24px except lodging (20px); preserve their root dimensions. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- local Figma vector asset */}
        <img src={`/expenses/${asset}.svg`} alt="" className={`max-w-none shrink-0 ${asset === "lodging" ? "" : "scale-[0.833333]"}`} />
      </span>
    </span>
  );
}
type PeopleProps = { members: RoomMember[]; memberStatus: MemberQueryStatus };
export function ExpensePerson({
  userId,
  members,
  memberStatus,
  compact = false,
}: PeopleProps & { userId: number; compact?: boolean }) {
  const person = expensePerson(userId, members, memberStatus);
  return (
    <span
      data-user-id={userId}
      title={person.label}
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle"
    >
      {person.imageUrl ? <ChatMemberAvatarRing
        avatarUrl={person.imageUrl ?? undefined}
        alt=""
        chromeAvatarClassName="h-6 w-6 shrink-0 overflow-hidden rounded-full border-[1.5px] border-white"
        reduceMotion={true}
      /> : <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-white bg-primary-subtle text-[12px] leading-4 text-primary">{person.label.slice(0, 1)}</span>}
      <span
        className={compact ? "sr-only" : "min-w-0 [overflow-wrap:anywhere]"}
      >
        {person.label}{" "}
        {(person.unknown || memberStatus !== "success") && (
          <span className="text-body-xs-regular text-dark-gray">#{userId}</span>
        )}
      </span>
    </span>
  );
}
export function expenseDayLabel(
  group: string,
  scheduleId: number | null,
  schedules: RoomSchedule[],
) {
  if (group === "PREPARATION") return "여행 준비";
  const day = schedules.find((s) => s.scheduleId === scheduleId);
  return day ? `${day.dayNumber}일차` : `일차 #${scheduleId}`;
}
export function ExpenseRolePicker({
  title,
  members,
  currentUserId,
  selected,
  original,
  onChange,
}: {
  title: string;
  members: RoomMember[];
  currentUserId?: number;
  selected: number[];
  original: number[];
  onChange: (ids: number[]) => void;
}) {
  const titleId = useId();
  const options = roleOptions(members, original, selected).sort(
    (a, b) =>
      Number(b.userId === currentUserId) - Number(a.userId === currentUserId),
  );
  const pendingMembers = members.filter(
    (member) =>
      member.status === "PENDING" &&
      original.includes(member.userId) &&
      selected.includes(member.userId),
  );
  return (
    <fieldset
      aria-labelledby={titleId}
      className="min-w-0 space-y-3 rounded-2xl bg-fill p-4 mobile:space-y-2 mobile:p-3 max-sm:space-y-2 max-sm:p-3"
    >
      <div
        id={titleId}
        className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-1"
      >
        <span className="text-[16px] leading-5 font-bold mobile:text-[14px] max-sm:text-[14px]">{title}</span>
        <span className="text-[12px] leading-5 font-normal text-text-subtle mobile:text-[10px] max-sm:text-[10px]">
          선택 {selected.length}명
        </span>
      </div>
      {options.map((option) => (
        <label
          key={option.userId}
          className="flex min-h-12 min-w-0 cursor-pointer items-center gap-2 rounded-lg bg-white px-3 text-[16px] leading-5 font-medium mobile:min-h-11 mobile:px-2 mobile:text-[12px] max-sm:min-h-11 max-sm:px-2 max-sm:text-[12px] transition-colors has-[:enabled]:hover:bg-primary/10 has-[:disabled]:cursor-not-allowed focus-within:ring-2 focus-within:ring-primary/40 has-[:checked]:bg-white has-[:checked]:ring-1 has-[:checked]:ring-primary/30 mobile:has-[:checked]:ring-0 max-sm:has-[:checked]:ring-0"
        >
          <input
            type="checkbox"
            checked={selected.includes(option.userId)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...selected, option.userId]
                  : selected.filter((id) => id !== option.userId),
              )
            }
            className="size-5 shrink-0 cursor-pointer appearance-none bg-[url(/expenses/checkbox.svg)] bg-contain bg-center bg-no-repeat checked:bg-[url(/expenses/checkbox-checked.svg)] disabled:cursor-not-allowed"
          />
          <ExpensePerson
            userId={option.userId}
            members={members}
            memberStatus="success"
          />
        </label>
      ))}
      {pendingMembers.map((member) => (
        <div
          key={member.userId}
          className="flex min-w-0 items-center justify-between gap-2 text-body-s-regular mobile:text-body-xs-regular"
        >
          <div className="min-w-0">
            <ExpensePerson
              userId={member.userId}
              members={members}
              memberStatus="success"
            />
            <p className="text-body-xs-regular text-dark-gray">승인 대기</p>
          </div>
          <button
            type="button"
            aria-label={`${title} ${member.nickname} #${member.userId} 제외`}
            className={`${expenseButtonClass} shrink-0`}
            onClick={() =>
              onChange(selected.filter((id) => id !== member.userId))
            }
          >
            제외
          </button>
        </div>
      ))}
      {pendingMembers.length > 0 && (
        <p className="text-body-xs-regular text-dark-gray">
          승인 대기 멤버가 남아 있으면 저장할 수 없어요. 제외하면 다시 추가할 수
          없어요.
        </p>
      )}
      {options.some((o) => o.historical) && (
        <p className="text-body-xs-regular text-dark-gray">
          기존 (알 수 없음) 멤버는 이 역할에서만 유지할 수 있으며, 해제하면 다시
          추가할 수 없어요.
        </p>
      )}
      {!options.length && !pendingMembers.length && (
        <p className="text-body-s-regular mobile:text-body-xs-regular text-dark-gray">
          선택 가능한 멤버가 없어요.
        </p>
      )}
    </fieldset>
  );
}
export function ExpenseList({
  roomId,
  expenses,
  members,
  memberStatus,
  schedules,
  canManage,
  onEdit,
  onDelete,
  busy,
  grouped = false,
  krwSummary,
}: PeopleProps & {
  roomId?: string;
  expenses: Expense[];
  schedules: RoomSchedule[];
  canManage: boolean;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
  busy: boolean;
  grouped?: boolean;
  krwSummary?: ExpenseKrwSummary;
}) {
  if (!expenses.length)
    return (
      <div className="rounded-xl border border-border-subtle bg-white px-4 py-9 text-center">
        <p className="font-semibold">아직 등록된 비용이 없어요.</p>
        <p className="mt-2 text-body-xs-regular text-text-subtle">
          여행 준비부터 오늘 쓴 비용까지 기록해 보세요.
        </p>
      </div>
    );
  const groupKeys = [
    ...new Set(
      expenses.map((e) =>
        e.expenseGroup === "PREPARATION" ? "PREPARATION" : String(e.scheduleId),
      ),
    ),
  ].sort((a, b) => {
    const order = (key: string) =>
      key === "PREPARATION"
        ? -1
        : (schedules.find((s) => String(s.scheduleId) === key)?.dayNumber ??
          Number.MAX_SAFE_INTEGER);
    return order(a) - order(b);
  });
  if (grouped)
    return (
      <div className="space-y-4 @min-[800px]/expenses:space-y-2">
        {groupKeys.map((key) => {
          const rows = expenses.filter(
            (e) =>
              (e.expenseGroup === "PREPARATION"
                ? "PREPARATION"
                : String(e.scheduleId)) === key,
          );
          const day = schedules.find((s) => String(s.scheduleId) === key);
          const date = day?.date ? new Date(`${day.date}T00:00:00Z`) : null;
          const dateLabel =
            date && !Number.isNaN(date.getTime())
              ? new Intl.DateTimeFormat("ko-KR", {
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                  timeZone: "UTC",
                }).format(date)
              : null;
          return (
            <section
              key={key}
              aria-label={
                key === "PREPARATION"
                  ? "여행 준비 비용"
                  : `${day?.dayNumber ?? ""}일차 비용`
              }
            >
              <div className="mb-4 flex min-h-8 flex-wrap items-center gap-2 @min-[800px]/expenses:mb-2 @min-[800px]/expenses:min-h-7 @min-[800px]/expenses:gap-3 @min-[800px]/expenses:px-4">
                <h3 className="text-[16px] leading-6 font-bold @min-[800px]/expenses:text-[20px]">
                  {key === "PREPARATION"
                    ? "여행 준비"
                    : (dateLabel ??
                      expenseDayLabel("TRIP_DAY", Number(key), schedules))}
                </h3>
                {day && (
                  <span className="rounded-full bg-primary-subtle px-2 py-1 text-label-xs-emphasis text-primary">
                    {day.dayNumber}일차
                  </span>
                )}
                <span className="text-[14px] leading-5 text-text-subtle"><ExpenseKrwAmount total={krwSummary?.days?.find((d) => key === "PREPARATION" ? d.expenseGroup === "PREPARATION" : d.expenseGroup === "TRIP_DAY" && String(d.scheduleId) === key)?.total} /></span>
                {!krwSummary && <span className="text-body-xs-regular text-text-subtle">
                  {totalsByCurrency(rows)
                    .map(
                      (t) => `${formatExpenseAmount(t.amount)} ${t.currency}`,
                    )
                    .join(" · ")}
                </span>}
              </div>
              <ExpenseList
                roomId={roomId}
                expenses={rows}
                krwSummary={krwSummary}
                members={members}
                memberStatus={memberStatus}
                schedules={schedules}
                canManage={canManage}
                busy={busy}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </section>
          );
        })}
      </div>
    );
  return (
    <ul className="space-y-4 @min-[800px]/expenses:space-y-0 @min-[800px]/expenses:rounded-xl @min-[800px]/expenses:border @min-[800px]/expenses:border-border-subtle @min-[800px]/expenses:bg-white">
      {expenses.map((e) => (
        <li
          key={e.id}
          data-expense-id={e.id}
          className="relative min-h-[154px] min-w-0 rounded-xl border border-border-subtle bg-white p-3 @min-[800px]/expenses:min-h-0 @min-[800px]/expenses:rounded-none @min-[800px]/expenses:border-0 @min-[800px]/expenses:bg-transparent @min-[800px]/expenses:px-4 @min-[800px]/expenses:py-0"
        >
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-2 @min-[800px]/expenses:min-h-[68px] @min-[800px]/expenses:gap-x-4 @min-[800px]/expenses:grid-cols-[minmax(0,1fr)_minmax(100px,200px)_minmax(120px,180px)_minmax(100px,200px)_24px] @min-[800px]/expenses:items-center">
            <div className="col-span-2 flex min-w-0 items-center gap-3 pr-10 @min-[800px]/expenses:col-span-1 @min-[800px]/expenses:gap-4 @min-[800px]/expenses:pr-0">
              <CategoryIcon category={e.category} />
              <div className="min-w-0">
                <p className="text-[14px] leading-5 font-medium @min-[800px]/expenses:text-[16px] @min-[800px]/expenses:leading-6">
                  {expenseTitle(e)}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-text-subtle @min-[800px]/expenses:text-[13px] @min-[800px]/expenses:leading-[18px]">
                  {expenseCategoryLabel(e.category)} ·{" "}
                  {roomId && e.scheduleId !== null && e.scheduleItemId !== null ? (
                    <ExpensePlaceLabel roomId={roomId} scheduleId={e.scheduleId} itemId={e.scheduleItemId} showIcon={false} />
                  ) : "장소 연결 없음"}
                </p>
              </div>
            </div>
            <div className="absolute right-3 top-3 @min-[800px]/expenses:static @min-[800px]/expenses:col-start-5 @min-[800px]/expenses:row-start-1 @min-[800px]/expenses:justify-self-end">
              {canManage && (
                <ExpenseItemMenu
                  label={expenseTitle(e)}
                  busy={busy}
                  onEdit={() => onEdit(e)}
                  onDelete={() => onDelete(e)}
                />
              )}
            </div>
            <p className="min-w-0 self-center whitespace-pre-wrap break-words text-[12px] leading-4 text-text-subtle @min-[800px]/expenses:text-[14px] @min-[800px]/expenses:leading-5 @min-[800px]/expenses:col-start-2 @min-[800px]/expenses:row-start-1">
              {e.memo || "메모 없음"}
            </p>
            <p className="break-all text-right text-[16px] leading-6 font-medium tabular-nums @min-[800px]/expenses:col-start-4 @min-[800px]/expenses:row-start-1">
              <ExpenseRowAmount expense={e} summary={krwSummary} />
            </p>
            <div className="col-span-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-text-subtle @min-[800px]/expenses:col-span-1 @min-[800px]/expenses:col-start-3 @min-[800px]/expenses:row-start-1 @min-[800px]/expenses:min-h-[68px] @min-[800px]/expenses:flex-col @min-[800px]/expenses:justify-center @min-[800px]/expenses:border-x @min-[800px]/expenses:border-border-subtle @min-[800px]/expenses:px-2 @min-[800px]/expenses:py-2">
              {(
                [
                  ["결제", e.payerUserIds],
                  ["분담", e.participantUserIds],
                ] as const
              ).map(([title, ids]) => (
                <div
                  key={title}
                  className="flex min-w-0 flex-wrap items-center gap-2 text-[12px] leading-4"
                >
                  <span className="mr-1 text-text-subtle">{title}</span>
                  <span className={ids.length > 1 ? "flex min-w-0 max-w-full flex-wrap gap-y-1 pr-1.5 [&>*]:-mr-1.5 [&>*]:shrink-0" : "flex shrink-0 max-w-full"}>{ids.map((id) => (
                    <ExpensePerson
                      key={id}
                      userId={id}
                      members={members}
                      memberStatus={memberStatus}
                      compact={
                        ids.length > 1 &&
                        memberStatus === "success" &&
                        members.some((member) => member.userId === id)
                      }
                    />
                  ))}</span>
                  {ids.length > 1 && (
                    <span className="text-text-subtle">{ids.length}명</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
type SettlementProps = PeopleProps & {
  krwSummary?: ExpenseKrwSummary;
  summary: ExpenseSummary;
  currentUserId?: number;
  scope?: "mine" | "all";
  onScopeChange?: (scope: "mine" | "all") => void;
  showDetails?: boolean;
};

function settlementBalance(amount: string) {
  const absolute = amount.replace(/^-/, "");
  if (/^0+(?:\.0+)?$/.test(absolute))
    return {
      label: "주고받을 금액 없음",
      amount: absolute,
      color: "text-dark-gray",
    };
  return amount.startsWith("-")
    ? { label: "보낼 금액", amount: absolute, color: "text-status-negative" }
    : { label: "받을 금액", amount: absolute, color: "text-primary-strong" };
}

function SettlementCalculation({
  paid,
  owed,
  currency,
  mine = false,
}: Readonly<{
  paid: string;
  owed: string;
  currency: string;
  mine?: boolean;
}>) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-3 text-body-s-regular mobile:text-body-xs-regular">
      {[
        [mine ? "내가 낸 금액" : "낸 금액", paid],
        [mine ? "내 몫" : "부담할 몫", owed],
      ].map(([label, value]) => (
        <div key={label}>
          <dt className="text-body-xs-regular text-dark-gray">{label}</dt>
          <dd className="mt-1 break-all font-medium tabular-nums">
            {formatExpenseAmount(value)} {currency}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function AllSettlement({ summary, members, memberStatus, krwSummary, showDetails = true }: SettlementProps) {
  const ids = [...new Set(summary.currencies.flatMap((c) => c.individuals.map((p) => p.userId)))];
  function amounts(id: number, field: "paidAmount" | "receive" | "send") {
    const rows = summary.currencies.flatMap((currency) => {
      const person = currency.individuals.find((p) => p.userId === id);
      if (!person) return [];
      const net = settlementBalance(person.netAmount);
      if (field !== "paidAmount" && net.label !== (field === "receive" ? "받을 금액" : "보낼 금액")) return [];
      return [{ currency: currency.currency, amount: field === "paidAmount" ? person.paidAmount : net.amount }];
    });
    return rows.length ? rows.map((row) => <span key={row.currency} className="block break-words tabular-nums sm:[&+span]:mt-1 mobile:[&+span]:mt-0">{row.currency} {formatExpenseAmount(row.amount)}</span>) : <span className="text-text-subtle">—</span>;
  }
  return (
    <div className="space-y-6 mobile:space-y-4 max-sm:space-y-4">
      <div className={`space-y-1 ${showDetails ? "" : "mobile:hidden max-sm:hidden"}`}>
        <p className="text-[16px] leading-6 font-medium mobile:text-[12px] mobile:text-text-subtle max-sm:text-[12px] max-sm:text-text-subtle">전체 여행 · {ids.length}명</p>
        <p className="text-[14px] leading-5 text-text-subtle mobile:hidden max-sm:hidden">결제 통화와 원화 환산 금액을 함께 확인해요.</p>
      </div>
      <div className="space-y-4 sm:space-y-0 sm:rounded-xl sm:border sm:border-border-subtle sm:bg-fill-subtle sm:px-4 sm:pt-3 mobile:space-y-4 mobile:pt-0 mobile:border-0 mobile:bg-white mobile:px-0">
        <div className="hidden min-h-9 grid-cols-[72fr_142fr_126fr_122fr_120fr] items-center gap-[10px] text-[12px] leading-[18px] text-text-subtle sm:grid mobile:hidden">
          <span>멤버</span><span className="text-right">결제한 금액</span><span className="text-right">원화 환산 합계</span><span className="text-right">받을 금액</span><span className="text-right">보낼 금액</span>
        </div>
        {ids.map((id) => (
          <div key={id} data-settlement-user-id={id} className="grid min-w-0 grid-cols-2 items-center gap-x-3 gap-y-2 rounded-xl border border-border-subtle bg-fill-subtle px-4 py-3 text-[14px] leading-5 sm:min-h-[88px] sm:grid-cols-[72fr_142fr_126fr_122fr_120fr] sm:gap-x-[10px] sm:gap-y-2 sm:rounded-none sm:border-0 sm:border-t sm:px-0 sm:text-[14px] sm:leading-[22px] mobile:min-h-0 mobile:grid-cols-2 mobile:gap-x-3 mobile:gap-y-2 mobile:rounded-xl mobile:border mobile:px-4 mobile:py-3 mobile:text-[14px] mobile:leading-5">
            <div className="col-start-1 row-start-1"><ExpensePerson userId={id} members={members} memberStatus={memberStatus} /></div>
            <div className="col-span-2 col-start-1 row-start-2 text-[12px] text-text-subtle sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:text-right sm:text-[14px] sm:text-text mobile:col-span-2 mobile:col-start-1 mobile:row-start-2 mobile:text-left mobile:text-[12px] mobile:text-text-subtle">
              <span className="mr-1 sm:hidden mobile:inline">결제</span><span className="inline [&>span]:inline [&>span+span]:before:content-['·_'] sm:block sm:[&>span]:block sm:[&>span+span]:before:content-none mobile:inline mobile:[&>span]:inline mobile:[&>span+span]:before:content-['·_']">{amounts(id, "paidAmount")}</span>
            </div>
            <div aria-label="원화 환산 합계" className="col-start-2 row-start-1 text-right text-[16px] leading-6 font-bold sm:col-start-3 sm:text-[14px] sm:font-medium mobile:text-[16px] mobile:font-bold mobile:col-start-2">
              <span className="block text-[12px] leading-5 font-normal text-text-subtle sm:hidden mobile:block">원화 환산 합계</span>
              <ExpenseKrwAmount total={krwSummary?.payers?.find((payer) => payer.userId === id)?.total} />
            </div>
            <div className="font-medium text-primary sm:text-right mobile:text-left"><span className="mb-1 block text-[12px] leading-5 font-normal text-text-subtle sm:hidden mobile:block">받을 금액</span>{amounts(id, "receive")}</div>
            <div className="text-right font-medium"><span className="mb-1 block text-[12px] leading-5 font-normal text-text-subtle sm:hidden mobile:block">보낼 금액</span>{amounts(id, "send")}</div>
          </div>
        ))}
      </div>
      <section className="space-y-3">
        <div className="space-y-1">
        <h3 className="text-[16px] leading-[22px] font-bold">송금 안내</h3>
        <p className="text-[12px] leading-[18px] text-text-subtle">원래 결제 통화 기준으로 송금해요.</p>
        </div>
        {summary.currencies.map((c) => (
          <section key={c.currency} aria-label={`${c.currency} 정산`} className="space-y-3">
            {!c.transfers.length && <p className="py-3 text-body-xs-regular text-text-subtle">{c.currency} · 주고받을 금액이 없어요.</p>}
            {c.transfers.map((t, index) => (
              <div key={index} className="flex min-h-10 flex-wrap items-center gap-2 text-[14px] leading-5">
                <ExpensePerson userId={t.fromUserId} members={members} memberStatus={memberStatus} />
                <ArrowRight size={16} aria-label="받는 사람" className="text-text-subtle" />
                <ExpensePerson userId={t.toUserId} members={members} memberStatus={memberStatus} />
                <span className="ml-auto break-all text-[16px] leading-6 font-medium text-primary mobile:text-[14px] max-sm:text-[14px]">{c.currency} {formatExpenseAmount(t.amount)}</span>
                {[t.fromUserId, t.toUserId].some((id) => expensePerson(id, members, memberStatus).unknown) && <p className="w-full text-text-subtle">사용자 정보를 확인할 수 없어요. 금액과 사용자 ID는 보존되어 있어요.</p>}
              </div>
            ))}
          </section>
        ))}
      </section>
      {showDetails && <details className="text-body-xs-regular text-text-subtle">
        <summary className="cursor-pointer">계산 내역·환율 정보</summary>
        {summary.currencies.map((currency) => <div key={currency.currency} className="mt-3 space-y-2">{currency.individuals.map((person) => <div key={person.userId} className="flex justify-between gap-3"><ExpensePerson userId={person.userId} members={members} memberStatus={memberStatus} /><span>부담할 몫 {currency.currency} {formatExpenseAmount(person.owedAmount)}</span></div>)}</div>)}
        <ExpenseRateNote summary={krwSummary} />
      </details>}
    </div>
  );
}

function SettlementContent({
  summary,
  members,
  memberStatus,
  currentUserId,
  scope,
  krwSummary,
  showDetails,
}: Readonly<SettlementProps>) {
  if (scope === "mine" && currentUserId === undefined) {
    return (
      <output
        style={{ display: "block" }}
        className="py-4 text-body-s-regular mobile:text-body-xs-regular text-dark-gray"
      >
        내 정산을 확인할 사용자 정보를 불러오는 중…
      </output>
    );
  }
  if (!summary.currencies.length) {
    return (
      <p className="py-6 text-center text-body-s-regular mobile:text-body-xs-regular text-dark-gray">
        정산할 비용이 없어요.
      </p>
    );
  }
  if (scope === "all")
    return (
      <AllSettlement
        summary={summary}
        members={members}
        memberStatus={memberStatus}
        krwSummary={krwSummary}
        showDetails={showDetails}
      />
    );
  return summary.currencies.map((c) => {
    const transfers =
      scope === "mine"
        ? c.transfers.filter(
            (t) =>
              t.fromUserId === currentUserId || t.toUserId === currentUserId,
          )
        : c.transfers;
    const me = c.individuals.find((p) => p.userId === currentUserId);
    return (
      <section
        key={c.currency}
        aria-label={`${c.currency} 정산`}
        className="min-w-0 space-y-3 border-b border-gray-border pb-5 last:border-b-0 last:pb-0"
      >
        <h3 className="text-body-s-emphasis mobile:text-body-xs-emphasis font-semibold text-dark-gray">
          {c.currency}
        </h3>
        {!transfers.length ? (
          <p className="rounded-xl bg-gray-50 px-4 py-5 text-body-s-regular mobile:text-body-xs-regular text-dark-gray">
            주고받을 금액이 없어요.
          </p>
        ) : (
          <ul className="divide-y divide-gray-border">
            {transfers.map((t, index) => {
              const sending = t.fromUserId === currentUserId;
              const counterparty = sending ? t.toUserId : t.fromUserId;
              return (
                <li
                  key={`${t.fromUserId}-${t.toUserId}-${index}`}
                  className="py-3 first:pt-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2 text-body-s-regular mobile:text-body-xs-regular">
                      {scope === "mine" ? (
                        <ExpensePerson
                          userId={counterparty}
                          members={members}
                          memberStatus={memberStatus}
                        />
                      ) : (
                        <>
                          <ExpensePerson
                            userId={t.fromUserId}
                            members={members}
                            memberStatus={memberStatus}
                          />
                          <ArrowRight
                            size={16}
                            aria-label="받는 사람"
                            className="shrink-0 text-dark-gray"
                          />
                          <ExpensePerson
                            userId={t.toUserId}
                            members={members}
                            memberStatus={memberStatus}
                          />
                        </>
                      )}
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-body-xs-regular text-dark-gray">
                        {scope === "mine" && !sending
                          ? "받을 금액"
                          : "보낼 금액"}
                      </p>
                      <p
                        className={`mt-0.5 break-all text-body-m-emphasis mobile:text-body-s-emphasis font-semibold tabular-nums ${scope === "mine" && sending ? "text-status-negative" : "text-primary-strong"}`}
                      >
                        {formatExpenseAmount(t.amount)} {c.currency}
                      </p>
                    </div>
                  </div>
                  {[t.fromUserId, t.toUserId].some(
                    (id) => expensePerson(id, members, memberStatus).unknown,
                  ) && (
                    <p className="mt-2 text-body-xs-regular text-dark-gray">
                      사용자 정보를 확인할 수 없어요. 금액과 사용자 ID는
                      보존되어 있어요.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {scope === "mine" && me && (
          <details className="group rounded-xl bg-gray-50 px-4 py-1">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-label-m-regular mobile:text-label-s-regular text-dark-gray focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
              계산 내역{" "}
              <ChevronDown
                size={16}
                className="group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="pb-3">
              <SettlementCalculation
                paid={me.paidAmount}
                owed={me.owedAmount}
                currency={c.currency}
                mine
              />
            </div>
          </details>
        )}
      </section>
    );
  });
}

export function ExpenseSummaryView({
  summary,
  members,
  memberStatus,
  currentUserId,
  scope = "mine",
  showDetails = true,
  onScopeChange,
  krwSummary,
}: SettlementProps) {
  return (
    <div className="flex flex-col gap-6 mobile:gap-4 max-sm:gap-4">
      {showDetails && <details className="order-last text-body-xs-regular text-text-subtle">
        <summary className="cursor-pointer">정산 범위</summary>
      <div
        className="flex gap-1 border-b border-gray-border"
        aria-label="정산 범위"
      >
        {(
          [
            ["mine", "내 정산"],
            ["all", "전체 정산"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={scope === value}
            onClick={() => onScopeChange?.(value)}
            className={`min-h-10 cursor-pointer border-b-2 px-3 py-2 text-label-m-emphasis mobile:text-label-s-emphasis font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${scope === value ? "border-primary text-primary-strong" : "border-transparent text-dark-gray hover:text-primary-strong"}`}
          >
            {label}
          </button>
        ))}
      </div>
      </details>}
      {krwSummary && (scope !== "all" || !summary.currencies.length) && <section aria-label="결제자별 원화 합계" className="space-y-3">
        <h3>원화 환산 결제 합계</h3>
        {krwSummary.payers?.filter((payer) => scope === "all" || payer.userId === currentUserId).map((payer) => <div key={payer.userId} className="flex justify-between gap-3">
          <ExpensePerson userId={payer.userId} members={members} memberStatus={memberStatus} />
          <ExpenseKrwAmount total={payer.total} />
        </div>)}
        <ExpenseRateNote summary={krwSummary} />
      </section>}
      <SettlementContent
        summary={summary}
        members={members}
        memberStatus={memberStatus}
        currentUserId={currentUserId}
        scope={scope}
        krwSummary={krwSummary}
        showDetails={showDetails}
      />
    </div>
  );
}

function ExpenseBarChart({
  title,
  currency,
  rows,
}: Readonly<{
  title: string;
  currency: string;
  rows: { id: string; label: string; amount: string }[];
}>) {
  // Visual proportions use numbers; displayed monetary amounts keep the exact server strings.
  const values = rows.map((row) => Math.max(0, Number(row.amount) || 0));
  const maximum = Math.max(0, ...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  return (
    <figure
      aria-label={`${currency} ${title} 비용 그래프`}
      className="min-w-0 rounded-2xl border border-gray-border p-4"
    >
      {!rows.length ? (
        <p className="py-4 text-body-s-regular mobile:text-body-xs-regular text-dark-gray">
          표시할 비용이 없어요.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row, index) => {
            const percentage =
              maximum > 0 ? (values[index] / maximum) * 100 : 0;
            const share = total > 0 ? values[index] / total : 0;
            const limePercent = (1 - share) * 12;
            return (
              <li
                key={row.id}
                aria-label={`${row.label} · ${formatExpenseAmount(row.amount)} ${currency}`}
              >
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-body-s-regular mobile:text-body-xs-regular">
                  <span className="min-w-0 break-words text-dark-gray">
                    {row.label}
                  </span>
                  <span className="break-all font-semibold tabular-nums">
                    {formatExpenseAmount(row.amount)}{" "}
                    <span className="text-body-xs-regular font-normal text-dark-gray">
                      {currency}
                    </span>
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="h-3 overflow-hidden rounded-full bg-gray-100"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${percentage}%`,
                      opacity: 0.75 + share * 0.25,
                      backgroundColor: `color-mix(in srgb, var(--color-primary-default) ${100 - limePercent}%, var(--color-secondary-default) ${limePercent}%)`,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}

export function ExpenseAnalysisView({
  summary,
  schedules,
}: PeopleProps & { summary: ExpenseSummary; schedules: RoomSchedule[] }) {
  const [groupBy, setGroupBy] = useState<"category" | "day">("category");
  return (
    <div className="space-y-6">
      <div
        className="flex gap-1 border-b border-gray-border"
        aria-label="비용 분석 기준"
      >
        {(
          [
            ["category", "카테고리별"],
            ["day", "일차별"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={groupBy === value}
            onClick={() => setGroupBy(value)}
            className={`min-h-10 cursor-pointer border-b-2 px-3 py-2 text-label-m-emphasis mobile:text-label-s-emphasis font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${groupBy === value ? "border-primary text-primary-strong" : "border-transparent text-dark-gray hover:text-primary-strong"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {!summary.currencies.length && (
        <p className="py-6 text-center text-body-s-regular mobile:text-body-xs-regular text-dark-gray">
          분석할 비용이 없어요.
        </p>
      )}
      {summary.currencies.map((c) => (
        <section
          key={c.currency}
          aria-label={`${c.currency} 비용 분석`}
          className="space-y-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-body-m-emphasis mobile:text-body-s-emphasis font-semibold">
              {c.currency}
            </h3>
            <p className="text-body-s-regular mobile:text-body-xs-regular text-dark-gray">
              합계{" "}
              <span className="ml-1 text-body-l-emphasis mobile:text-body-m-emphasis font-bold tabular-nums text-text">
                {formatExpenseAmount(c.totalAmount)}
              </span>{" "}
              {c.currency}
            </p>
          </div>
          {groupBy === "category" ? (
            <ExpenseBarChart
              title="카테고리별"
              currency={c.currency}
              rows={c.categories.map((t) => ({
                id: t.category,
                label: expenseCategoryLabel(t.category),
                amount: t.totalAmount,
              }))}
            />
          ) : (
            <ExpenseBarChart
              title="준비·일차별"
              currency={c.currency}
              rows={[...c.days]
                .sort((a, b) => {
                  const order = (day: typeof a) =>
                    day.expenseGroup === "PREPARATION"
                      ? -1
                      : (schedules.find((s) => s.scheduleId === day.scheduleId)
                          ?.dayNumber ?? Number.MAX_SAFE_INTEGER);
                  return order(a) - order(b);
                })
                .map((t) => ({
                  id: `${t.expenseGroup}-${t.scheduleId}`,
                  label: expenseDayLabel(
                    t.expenseGroup,
                    t.scheduleId,
                    schedules,
                  ),
                  amount: t.totalAmount,
                }))}
            />
          )}
        </section>
      ))}
    </div>
  );
}
