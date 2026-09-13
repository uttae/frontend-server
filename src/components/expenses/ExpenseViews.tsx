"use client";

import { useId } from "react";
import {
  ArrowRight,
  BedDouble,
  Camera,
  ChevronDown,
  Plane,
  ReceiptText,
  ShoppingBag,
  TrainFront,
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
  "min-h-10 rounded-full border border-gray-border px-3 py-2 text-sm font-semibold cursor-pointer transition-colors enabled:hover:border-primary/40 enabled:hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";
export const expenseInputClass =
  "mt-1 min-h-11 w-full min-w-0 rounded-xl border border-gray-border bg-white px-3 py-2 text-base focus:outline-primary";
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
          <span className="text-xs text-dark-gray">#{userId}</span>
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
      className="min-w-0 space-y-3 rounded-2xl bg-light-gray/50 p-4"
    >
      <div
        id={titleId}
        className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-1"
      >
        <span className="font-semibold">{title}</span>
        <span className="text-xs font-medium text-dark-gray">
          선택 {selected.length}명
        </span>
      </div>
      {options.map((option) => (
        <label
          key={option.userId}
          className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm transition-colors has-[:enabled]:hover:bg-primary/10 has-[:disabled]:cursor-not-allowed focus-within:ring-2 focus-within:ring-primary/40 has-[:checked]:bg-white has-[:checked]:ring-1 has-[:checked]:ring-primary/30"
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
          className="flex min-w-0 items-center justify-between gap-2 text-sm"
        >
          <div className="min-w-0">
            <ExpensePerson
              userId={member.userId}
              members={members}
              memberStatus="success"
            />
            <p className="text-xs text-dark-gray">승인 대기</p>
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
        <p className="text-xs text-dark-gray">
          승인 대기 멤버가 남아 있으면 저장할 수 없어요. 제외하면 다시 추가할 수
          없어요.
        </p>
      )}
      {options.some((o) => o.historical) && (
        <p className="text-xs text-dark-gray">
          기존 (알 수 없음) 멤버는 이 역할에서만 유지할 수 있으며, 해제하면 다시
          추가할 수 없어요.
        </p>
      )}
      {!options.length && !pendingMembers.length && (
        <p className="text-sm text-dark-gray">선택 가능한 멤버가 없어요.</p>
      )}
    </fieldset>
  );
}
export function ExpenseList({
  expenses,
  members,
  memberStatus,
  schedules,
  canManage,
  onEdit,
  onDelete,
  busy,
}: PeopleProps & {
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
        <p className="text-sm text-dark-gray">
          여행 준비부터 오늘 쓴 비용까지 기록해 보세요.
        </p>
      </div>
    );
  return (
    <ul className="divide-y divide-gray-border">
      {expenses.map((e) => (
        <li key={e.id} className="min-w-0 py-4 first:pt-1 last:pb-0">
          <div className="flex items-start gap-3">
            <CategoryIcon category={e.category} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="min-w-0 flex-1 basis-28 break-words font-semibold">
                  {e.memo || expenseCategoryLabel(e.category)}
                </p>
                <p className="max-w-full break-all text-right text-base font-bold tabular-nums">
                  {formatExpenseAmount(e.totalAmount)}{" "}
                  <span className="text-xs font-medium text-dark-gray">
                    {e.currency}
                  </span>
                </p>
              </div>
              <p className="mt-1 text-xs text-dark-gray">
                {expenseDayLabel(e.expenseGroup, e.scheduleId, schedules)} ·{" "}
                {expenseCategoryLabel(e.category)}
              </p>
              <details className="group mt-2">
                <summary className="flex min-h-8 w-fit cursor-pointer list-none rounded-lg px-1 transition-colors hover:bg-primary/5 hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary items-center gap-1 text-xs text-dark-gray [&::-webkit-details-marker]:hidden">
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
                      className="flex flex-wrap items-center gap-2 text-sm"
                    >
                      <span className="text-xs text-dark-gray">{title}</span>
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
                  {e.scheduleItemId !== null && (
                    <p className="text-xs text-dark-gray">
                      연결 장소 #{e.scheduleItemId}
                    </p>
                  )}
                  {canManage && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={expenseButtonClass}
                        disabled={busy}
                        onClick={() => onEdit(e)}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className={`${expenseButtonClass} text-status-negative`}
                        disabled={busy}
                        onClick={() => onDelete(e)}
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              </details>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
export function ExpenseSummaryView({
  summary,
  members,
  memberStatus,
  schedules,
}: PeopleProps & { summary: ExpenseSummary; schedules: RoomSchedule[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-dark-gray">
        방 전체 지출을 기준으로 정산해요. 아래 금액을 확인하고 직접 송금해
        주세요.
      </p>
      {!summary.currencies.length && (
        <p className="py-4 text-center text-dark-gray">정산할 지출이 없어요.</p>
      )}
      {summary.currencies.map((c) => (
        <section
          key={c.currency}
          aria-label={`${c.currency} 정산`}
          className="min-w-0 space-y-4 border-b border-gray-border pb-6 last:border-b-0 last:pb-0"
        >
          <h3 className="break-all text-lg font-bold">
            {c.currency} 합계{" "}
            <span className="tabular-nums">
              {formatExpenseAmount(c.totalAmount)}
            </span>
          </h3>
          <h4 className="font-semibold">송금 제안</h4>
          {!c.transfers.length && (
            <p className="text-sm text-dark-gray">제안할 송금이 없어요.</p>
          )}
          <ul className="space-y-2">
            {c.transfers.map((t, index) => (
              <li
                key={index}
                className="space-y-2 rounded-xl bg-primary/5 p-4 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
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
                </div>
                <p className="break-all font-bold tabular-nums">
                  {formatExpenseAmount(t.amount)} {c.currency}
                </p>
                {[t.fromUserId, t.toUserId].some(
                  (id) => expensePerson(id, members, memberStatus).unknown,
                ) && (
                  <p className="text-xs text-dark-gray">
                    사용자 정보를 확인할 수 없어요. 금액과 사용자 ID는 보존되어
                    있어요.
                  </p>
                )}
              </li>
            ))}
          </ul>
          <h4 className="font-semibold">멤버별 정산</h4>
          <p className="text-xs text-dark-gray">
            순액: 양수는 받을 금액, 음수는 보낼 금액
          </p>
          <ul className="space-y-2">
            {c.individuals.map((p) => (
              <li
                key={p.userId}
                className="border-b border-gray-border py-3 text-sm last:border-b-0"
              >
                <ExpensePerson
                  userId={p.userId}
                  members={members}
                  memberStatus={memberStatus}
                />
                <dl className="mt-2 grid grid-cols-1 gap-2 @min-[480px]/expenses:grid-cols-3">
                  {[
                    ["결제", p.paidAmount],
                    ["부담", p.owedAmount],
                    ["순액", p.netAmount],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-dark-gray">{label}</dt>
                      <dd className="break-all font-semibold tabular-nums">
                        {formatExpenseAmount(value)} {c.currency}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          <details className="group border-t border-gray-border pt-4">
            <summary className="flex min-h-10 cursor-pointer list-none rounded-lg px-1 transition-colors hover:bg-primary/5 hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-primary items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
              지출 분석{" "}
              <ChevronDown
                size={16}
                className="group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="grid gap-2 text-sm @min-[480px]/expenses:grid-cols-2">
              <div>
                <h4 className="mb-1 font-semibold">카테고리별</h4>
                {c.categories.map((t) => (
                  <p key={t.category} className="break-all">
                    {expenseCategoryLabel(t.category)} ·{" "}
                    {formatExpenseAmount(t.totalAmount)} {c.currency}
                  </p>
                ))}
              </div>
              <div>
                <h4 className="mb-1 font-semibold">준비·일차별</h4>
                {c.days.map((t) => (
                  <p
                    key={`${t.expenseGroup}-${t.scheduleId}`}
                    className="break-all"
                  >
                    {expenseDayLabel(t.expenseGroup, t.scheduleId, schedules)} ·{" "}
                    {formatExpenseAmount(t.totalAmount)} {c.currency}
                  </p>
                ))}
              </div>
            </div>
          </details>
        </section>
      ))}
    </div>
  );
}
