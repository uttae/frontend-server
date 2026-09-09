"use client";

import {
  expenseCategoryLabel,
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
  "min-h-10 rounded-xl border border-gray-border px-3 py-2 text-sm font-semibold transition hover:bg-light-gray disabled:cursor-not-allowed disabled:opacity-50";
export const expenseInputClass =
  "mt-1 min-h-11 w-full min-w-0 rounded-xl border border-gray-border bg-white px-3 py-2 text-base focus:outline-primary";
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
      className="inline-flex min-w-0 items-center gap-1.5 align-middle"
    >
      <ChatMemberAvatarRing
        avatarUrl={person.imageUrl ?? undefined}
        alt=""
        chromeAvatarClassName="h-7 w-7 shrink-0 overflow-hidden rounded-full"
        reduceMotion={true}
      />
      <span className="break-words">
        {person.label} <span className="text-xs text-dark-gray">#{userId}</span>
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
  selected,
  original,
  onChange,
}: {
  title: string;
  members: RoomMember[];
  selected: number[];
  original: number[];
  onChange: (ids: number[]) => void;
}) {
  const options = roleOptions(members, original, selected);
  return (
    <fieldset className="min-w-0 space-y-2 rounded-xl border border-gray-border p-3">
      <legend className="px-1 font-semibold">
        {title} · 균등 분담 ({selected.length}명)
      </legend>
      {options.map((option) => (
        <label
          key={option.userId}
          className="flex min-h-10 cursor-pointer items-center gap-2 text-sm"
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
            className="h-4 w-4 shrink-0 accent-primary"
          />
          <ExpensePerson
            userId={option.userId}
            members={members}
            memberStatus="success"
          />
        </label>
      ))}
      {options.some((o) => o.historical) && (
        <p className="text-xs text-dark-gray">
          기존 (알 수 없음) 멤버는 이 역할에서만 유지할 수 있으며, 해제하면 다시
          추가할 수 없어요.
        </p>
      )}
      {!options.length && (
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
      <p className="py-6 text-center text-dark-gray">
        아직 등록된 지출이 없어요.
      </p>
    );
  return (
    <ul className="space-y-3">
      {expenses.map((e) => (
        <li
          key={e.id}
          className="min-w-0 space-y-3 rounded-2xl border border-gray-border bg-white p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-dark-gray">
                {expenseDayLabel(e.expenseGroup, e.scheduleId, schedules)} ·
                {expenseCategoryLabel(e.category)}
                {e.scheduleItemId !== null
                  ? ` · 연결 장소 #${e.scheduleItemId}`
                  : ""}
              </p>
              <p className="break-all text-lg font-bold tabular-nums">
                {e.totalAmount} <span className="text-sm">{e.currency}</span>
              </p>
            </div>
            {canManage && (
              <div className="flex gap-1">
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
                  className={expenseButtonClass}
                  disabled={busy}
                  onClick={() => onDelete(e)}
                >
                  삭제
                </button>
              </div>
            )}
          </div>
          {e.memo && (
            <p className="whitespace-pre-wrap break-words text-sm">{e.memo}</p>
          )}
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
              <span className="text-dark-gray">{title}</span>
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
        방 전체 지출의 서버 정산 결과예요. 통화별로 따로 표시하며 송금 제안은
        실제 이체를 실행하지 않아요.
      </p>
      {!summary.currencies.length && (
        <p className="py-4 text-center text-dark-gray">정산할 지출이 없어요.</p>
      )}
      {summary.currencies.map((c) => (
        <section
          key={c.currency}
          aria-label={`${c.currency} 정산`}
          className="min-w-0 space-y-4 rounded-2xl border border-gray-border p-4"
        >
          <h3 className="break-all text-lg font-bold">
            {c.currency} 합계{" "}
            <span className="tabular-nums">{c.totalAmount}</span>
          </h3>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <h4 className="mb-1 font-semibold">카테고리별</h4>
              {c.categories.map((t) => (
                <p key={t.category} className="break-all">
                  {expenseCategoryLabel(t.category)} · {t.totalAmount}{" "}
                  {c.currency}
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
                  {t.totalAmount} {c.currency}
                </p>
              ))}
            </div>
          </div>
          <h4 className="font-semibold">멤버별 정산</h4>
          <p className="text-xs text-dark-gray">
            순액: 양수는 받을 금액, 음수는 보낼 금액
          </p>
          <ul className="space-y-2">
            {c.individuals.map((p) => (
              <li
                key={p.userId}
                className="rounded-xl bg-light-gray/50 p-3 text-sm"
              >
                <ExpensePerson
                  userId={p.userId}
                  members={members}
                  memberStatus={memberStatus}
                />
                <dl className="mt-2 grid grid-cols-1 gap-2 min-[480px]:grid-cols-3">
                  {[
                    ["결제", p.paidAmount],
                    ["부담", p.owedAmount],
                    ["순액", p.netAmount],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-dark-gray">{label}</dt>
                      <dd className="break-all font-semibold tabular-nums">
                        {value} {c.currency}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          <h4 className="font-semibold">송금 제안</h4>
          {!c.transfers.length && (
            <p className="text-sm text-dark-gray">제안할 송금이 없어요.</p>
          )}
          <ul className="space-y-2">
            {c.transfers.map((t, index) => (
              <li
                key={index}
                className="space-y-2 rounded-xl border border-gray-border p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <ExpensePerson
                    userId={t.fromUserId}
                    members={members}
                    memberStatus={memberStatus}
                  />
                  <span aria-label="받는 사람">→</span>
                  <ExpensePerson
                    userId={t.toUserId}
                    members={members}
                    memberStatus={memberStatus}
                  />
                </div>
                <p className="break-all font-bold tabular-nums">
                  {t.amount} {c.currency}
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
        </section>
      ))}
    </div>
  );
}
