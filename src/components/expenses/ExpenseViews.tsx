"use client";

import { useId, useState } from "react";
import { ExpensePlaceLabel } from "./ExpensePlaceLabel";
import {
  ArrowRight,
  BedDouble,
  Camera,
  ChevronDown,
  Plane,
  ReceiptText,
  ShoppingBag,
  TrainFront,
  Trash2,
  Utensils,
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
  "min-h-10 rounded-full border border-gray-border px-3 py-2 text-label-m-emphasis mobile:text-label-s-emphasis font-semibold cursor-pointer transition-colors enabled:hover:border-primary/40 enabled:hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";
export const expenseInputClass =
  "mt-1 min-h-11 w-full min-w-0 rounded-xl border border-gray-border bg-white px-3 py-2 text-body-m-regular focus:outline-primary";
// Group the integer string directly so large amounts and trailing decimals stay exact.
export function formatExpenseAmount(amount: string) {
  if (!/^-?\d*(?:\.\d*)?$/.test(amount)) return amount;
  const [integer, fraction] = amount.split(".");
  return (
    integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    (fraction === undefined ? "" : `.${fraction}`)
  );
}
const categoryIcons = {
  FLIGHT: Plane,
  ACCOMMODATION: BedDouble,
  FOOD: Utensils,
  TRANSPORT: TrainFront,
  SHOPPING: ShoppingBag,
  SIGHTSEEING: Camera,
  OTHER: ReceiptText,
};
function CategoryIcon({ category }: { category: ExpenseCategory }) {
  const Icon = categoryIcons[category] ?? ReceiptText;
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-light-gray text-dark-gray">
      <Icon size={19} aria-hidden="true" />
    </span>
  );
}
type PeopleProps = { members: RoomMember[]; memberStatus: MemberQueryStatus };
export function ExpensePerson({
  userId,
  members,
  memberStatus,
}: PeopleProps & { userId: number }) {
  const person = expensePerson(userId, members, memberStatus);
  return (
    <span
      data-user-id={userId}
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle"
    >
      <ChatMemberAvatarRing
        avatarUrl={person.imageUrl ?? undefined}
        alt=""
        chromeAvatarClassName="h-7 w-7 shrink-0 overflow-hidden rounded-full"
        reduceMotion={true}
      />
      <span className="min-w-0 [overflow-wrap:anywhere]">
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
      className="min-w-0 space-y-3 rounded-2xl bg-gray-50 p-4"
    >
      <div
        id={titleId}
        className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-1"
      >
        <span className="font-semibold">{title}</span>
        <span className="text-body-xs-emphasis font-medium text-dark-gray">
          선택 {selected.length}명
        </span>
      </div>
      {options.map((option) => (
        <label
          key={option.userId}
          className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-label-m-regular mobile:text-label-s-regular transition-colors has-[:enabled]:hover:bg-primary/10 has-[:disabled]:cursor-not-allowed focus-within:ring-2 focus-within:ring-primary/40 has-[:checked]:bg-white has-[:checked]:ring-1 has-[:checked]:ring-primary/30"
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
            className="h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed"
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
        <p className="text-body-s-regular mobile:text-body-xs-regular text-dark-gray">선택 가능한 멤버가 없어요.</p>
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
}: PeopleProps & {
  roomId?: string;
  expenses: Expense[];
  schedules: RoomSchedule[];
  canManage: boolean;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
  busy: boolean;
}) {
  if (!expenses.length)
    return (
      <div className="flex flex-col items-center gap-2 py-9 text-center">
        <ReceiptText
          size={28}
          className="mb-1 text-dark-gray"
          aria-hidden="true"
        />
        <p className="font-semibold">아직 등록된 지출이 없어요.</p>
        <p className="text-body-s-regular mobile:text-body-xs-regular text-dark-gray">
          여행 준비부터 오늘 쓴 비용까지 기록해 보세요.
        </p>
      </div>
    );
  return (
    <ul className="divide-y divide-gray-border">
      {expenses.map((e) => (
        <li key={e.id} className="min-w-0 py-1">
          <div className={`relative min-w-0 rounded-xl p-3 transition-colors ${canManage && !busy ? "hover:bg-primary/5" : ""}`}>
          {canManage && (
            <button
              type="button"
              aria-label={`${e.memo || expenseCategoryLabel(e.category)} ${formatExpenseAmount(e.totalAmount)} ${e.currency} 비용 수정`}
              aria-haspopup="dialog"
              disabled={busy}
              onClick={() => onEdit(e)}
              className="absolute inset-0 z-10 cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed"
            />
          )}
          <div className="flex items-start gap-3">
            <CategoryIcon category={e.category} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="flex min-w-0 flex-1 basis-28 flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="break-words font-semibold">
                    {e.memo || expenseCategoryLabel(e.category)}
                  </p>
                  {roomId && e.scheduleId !== null && e.scheduleItemId !== null && (
                    <ExpensePlaceLabel roomId={roomId} scheduleId={e.scheduleId} itemId={e.scheduleItemId} />
                  )}
                </div>
                <p className="max-w-full break-all text-right text-body-m-emphasis mobile:text-body-s-emphasis font-bold tabular-nums">
                  {formatExpenseAmount(e.totalAmount)}{" "}
                  <span className="text-body-xs-emphasis font-medium text-dark-gray">
                    {e.currency}
                  </span>
                </p>
              </div>
              <p className="mt-1 text-body-xs-regular text-dark-gray">
                {expenseDayLabel(e.expenseGroup, e.scheduleId, schedules)} ·{" "}
                {expenseCategoryLabel(e.category)}
              </p>
              <div className="relative mt-2">
              <details className="group pointer-events-none relative z-20 pr-10">
                <summary className="pointer-events-auto flex min-h-8 w-fit cursor-pointer list-none rounded-lg px-1 transition-colors hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary items-center gap-1 text-label-xs-regular text-dark-gray [&::-webkit-details-marker]:hidden">
                  결제·분담 내역{" "}
                  <ChevronDown
                    size={14}
                    className="transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="mt-1 space-y-3 border-l-2 border-gray-border py-2 pl-3">
                  {(
                    [
                      ["결제자", e.payerUserIds],
                      ["부담자", e.participantUserIds],
                    ] as const
                  ).map(([title, ids]) => (
                    <div
                      key={title}
                      className="flex flex-wrap items-center gap-2 text-body-s-regular mobile:text-body-xs-regular"
                    >
                      <span className="text-body-xs-regular text-dark-gray">{title}</span>
                      {ids.map((id) => (
                        <ExpensePerson
                          key={id}
                          userId={id}
                          members={members}
                          memberStatus={memberStatus}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </details>
              {canManage && (
                <div className="absolute right-0 top-0 z-20">
                  <button
                    type="button"
                    aria-label="비용 삭제"
                    title="비용 삭제"
                    disabled={busy}
                    onClick={() => onDelete(e)}
                    className="relative z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-dark-gray transition-colors hover:text-status-negative focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
              </div>
            </div>
          </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
type SettlementProps = PeopleProps & {
  summary: ExpenseSummary;
  currentUserId?: number;
  scope?: "mine" | "all";
  onScopeChange?: (scope: "mine" | "all") => void;
};

function settlementBalance(amount: string) {
  const absolute = amount.replace(/^-/, "");
  if (/^0+(?:\.0+)?$/.test(absolute)) return { label: "주고받을 금액 없음", amount: absolute, color: "text-dark-gray" };
  return amount.startsWith("-")
    ? { label: "보낼 금액", amount: absolute, color: "text-status-negative" }
    : { label: "받을 금액", amount: absolute, color: "text-primary-strong" };
}

function SettlementCalculation({ paid, owed, currency, mine = false }: Readonly<{
  paid: string; owed: string; currency: string; mine?: boolean;
}>) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-3 text-body-s-regular mobile:text-body-xs-regular">
      {[[mine ? "내가 낸 금액" : "낸 금액", paid], [mine ? "내 몫" : "부담할 몫", owed]].map(([label, value]) => (
        <div key={label}>
          <dt className="text-body-xs-regular text-dark-gray">{label}</dt>
          <dd className="mt-1 break-all font-medium tabular-nums">{formatExpenseAmount(value)} {currency}</dd>
        </div>
      ))}
    </dl>
  );
}

function SettlementContent({ summary, members, memberStatus, currentUserId, scope }: Readonly<SettlementProps>) {
  if (scope === "mine" && currentUserId === undefined) {
    return <output style={{ display: "block" }} className="py-4 text-body-s-regular mobile:text-body-xs-regular text-dark-gray">내 정산을 확인할 사용자 정보를 불러오는 중…</output>;
  }
  if (!summary.currencies.length) {
    return <p className="py-6 text-center text-body-s-regular mobile:text-body-xs-regular text-dark-gray">정산할 지출이 없어요.</p>;
  }
  return summary.currencies.map((c) => {
    const transfers = scope === "mine" ? c.transfers.filter(t => t.fromUserId === currentUserId || t.toUserId === currentUserId) : c.transfers;
    const me = c.individuals.find(p => p.userId === currentUserId);
    return (
      <section key={c.currency} aria-label={`${c.currency} 정산`} className="min-w-0 space-y-3 border-b border-gray-border pb-5 last:border-b-0 last:pb-0">
        <h3 className="text-body-s-emphasis mobile:text-body-xs-emphasis font-semibold text-dark-gray">{c.currency}</h3>
        {!transfers.length ? (
          <p className="rounded-xl bg-gray-50 px-4 py-5 text-body-s-regular mobile:text-body-xs-regular text-dark-gray">주고받을 금액이 없어요.</p>
        ) : (
          <ul className="divide-y divide-gray-border">
            {transfers.map((t, index) => {
              const sending = t.fromUserId === currentUserId;
              const counterparty = sending ? t.toUserId : t.fromUserId;
              return (
                <li key={`${t.fromUserId}-${t.toUserId}-${index}`} className="py-3 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2 text-body-s-regular mobile:text-body-xs-regular">
                      {scope === "mine" ? (
                        <ExpensePerson userId={counterparty} members={members} memberStatus={memberStatus} />
                      ) : (
                        <>
                          <ExpensePerson userId={t.fromUserId} members={members} memberStatus={memberStatus} />
                          <ArrowRight size={16} aria-label="받는 사람" className="shrink-0 text-dark-gray" />
                          <ExpensePerson userId={t.toUserId} members={members} memberStatus={memberStatus} />
                        </>
                      )}
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-body-xs-regular text-dark-gray">{scope === "mine" && !sending ? "받을 금액" : "보낼 금액"}</p>
                      <p className={`mt-0.5 break-all text-body-m-emphasis mobile:text-body-s-emphasis font-semibold tabular-nums ${scope === "mine" && sending ? "text-status-negative" : "text-primary-strong"}`}>
                        {formatExpenseAmount(t.amount)} {c.currency}
                      </p>
                    </div>
                  </div>
                  {[t.fromUserId, t.toUserId].some(id => expensePerson(id, members, memberStatus).unknown) && (
                    <p className="mt-2 text-body-xs-regular text-dark-gray">사용자 정보를 확인할 수 없어요. 금액과 사용자 ID는 보존되어 있어요.</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {scope === "mine" && me && (
          <details className="group rounded-xl bg-gray-50 px-4 py-1">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-label-m-regular mobile:text-label-s-regular text-dark-gray focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
              계산 내역 <ChevronDown size={16} className="group-open:rotate-180" aria-hidden />
            </summary>
            <div className="pb-3"><SettlementCalculation paid={me.paidAmount} owed={me.owedAmount} currency={c.currency} mine /></div>
          </details>
        )}
        {scope === "all" && (
          <details className="group rounded-xl bg-gray-50 px-4 py-1">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-label-m-regular mobile:text-label-s-regular text-dark-gray focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
              멤버별 계산 내역 <ChevronDown size={16} className="group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="divide-y divide-gray-border">
              {c.individuals.map(p => {
                const balance = settlementBalance(p.netAmount);
                return (
                  <li key={p.userId} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-body-s-regular mobile:text-body-xs-regular">
                      <ExpensePerson userId={p.userId} members={members} memberStatus={memberStatus} />
                      <span className={`font-semibold ${balance.color}`}>{balance.label} {formatExpenseAmount(balance.amount)} {c.currency}</span>
                    </div>
                    <SettlementCalculation paid={p.paidAmount} owed={p.owedAmount} currency={c.currency} />
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </section>
    );
  });
}

export function ExpenseSummaryView({
  summary, members, memberStatus, currentUserId, scope = "mine", onScopeChange,
}: SettlementProps) {
  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-gray-border" aria-label="정산 범위">
        {([ ["mine", "내 정산"], ["all", "전체 정산"] ] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={scope === value} onClick={() => onScopeChange?.(value)}
            className={`min-h-10 cursor-pointer border-b-2 px-3 py-2 text-label-m-emphasis mobile:text-label-s-emphasis font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary ${scope === value ? "border-primary text-primary-strong" : "border-transparent text-dark-gray hover:text-primary-strong"}`}>
            {label}
          </button>
        ))}
      </div>
      <SettlementContent summary={summary} members={members} memberStatus={memberStatus} currentUserId={currentUserId} scope={scope} />
    </div>
  );
}

function ExpenseBarChart({ title, currency, rows }: Readonly<{
  title: string;
  currency: string;
  rows: { id: string; label: string; amount: string }[];
}>) {
  // Visual proportions use numbers; displayed monetary amounts keep the exact server strings.
  const values = rows.map(row => Math.max(0, Number(row.amount) || 0));
  const maximum = Math.max(0, ...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  return (
    <figure aria-label={`${currency} ${title} 지출 그래프`} className="min-w-0 rounded-2xl border border-gray-border p-4">
      {!rows.length ? (
        <p className="py-4 text-body-s-regular mobile:text-body-xs-regular text-dark-gray">표시할 지출이 없어요.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row, index) => {
            const percentage = maximum > 0 ? values[index] / maximum * 100 : 0;
            const share = total > 0 ? values[index] / total : 0;
            const limePercent = (1 - share) * 12;
            return (
              <li key={row.id} aria-label={`${row.label} · ${formatExpenseAmount(row.amount)} ${currency}`}>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-body-s-regular mobile:text-body-xs-regular">
                  <span className="min-w-0 break-words text-dark-gray">{row.label}</span>
                  <span className="break-all font-semibold tabular-nums">{formatExpenseAmount(row.amount)} <span className="text-body-xs-regular font-normal text-dark-gray">{currency}</span></span>
                </div>
                <div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-gray-100">
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

export function ExpenseAnalysisView({ summary, schedules }: PeopleProps & { summary: ExpenseSummary; schedules: RoomSchedule[] }) {
  const [groupBy, setGroupBy] = useState<"category" | "day">("category");
  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-gray-border" aria-label="지출 분석 기준">
        {([["category", "카테고리별"], ["day", "일차별"]] as const).map(([value, label]) => (
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
      {!summary.currencies.length && <p className="py-6 text-center text-body-s-regular mobile:text-body-xs-regular text-dark-gray">분석할 지출이 없어요.</p>}
      {summary.currencies.map(c => (
        <section key={c.currency} aria-label={`${c.currency} 지출 분석`} className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-body-m-emphasis mobile:text-body-s-emphasis font-semibold">{c.currency}</h3>
            <p className="text-body-s-regular mobile:text-body-xs-regular text-dark-gray">합계 <span className="ml-1 text-body-l-emphasis mobile:text-body-m-emphasis font-bold tabular-nums text-text">{formatExpenseAmount(c.totalAmount)}</span> {c.currency}</p>
          </div>
          {groupBy === "category" ? (
          <ExpenseBarChart
            title="카테고리별"
            currency={c.currency}
            rows={c.categories.map(t => ({ id: t.category, label: expenseCategoryLabel(t.category), amount: t.totalAmount }))}
          />
          ) : (
          <ExpenseBarChart
            title="준비·일차별"
            currency={c.currency}
            rows={[...c.days].sort((a, b) => {
              const order = (day: typeof a) => day.expenseGroup === "PREPARATION" ? -1 : schedules.find(s => s.scheduleId === day.scheduleId)?.dayNumber ?? Number.MAX_SAFE_INTEGER;
              return order(a) - order(b);
            }).map(t => ({ id: `${t.expenseGroup}-${t.scheduleId}`, label: expenseDayLabel(t.expenseGroup, t.scheduleId, schedules), amount: t.totalAmount }))}
          />
          )}
        </section>
      ))}
    </div>
  );
}
