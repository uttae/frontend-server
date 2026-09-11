import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import {
  ExpenseList,
  ExpenseSummaryView,
  ExpenseRolePicker,
} from "./ExpenseViews";
const expense = {
  id: 10,
  expenseGroup: "PREPARATION" as const,
  scheduleId: null,
  scheduleItemId: null,
  totalAmount: "10.01",
  currency: "USD",
  category: "OTHER" as const,
  memo: "준비 비용",
  payerUserIds: [1, 2],
  participantUserIds: [1, 2, 3],
  createdAt: "",
  updatedAt: "",
};

it("groups category and daily totals without losing decimal precision", () => {
  const html = renderToStaticMarkup(
    <ExpenseSummaryView
      members={[]}
      memberStatus="success"
      schedules={[]}
      summary={{
        currencies: [
          {
            currency: "USD",
            totalAmount: "1234567.00",
            categories: [{ category: "OTHER", totalAmount: "1234567.00" }],
            days: [
              {
                expenseGroup: "PREPARATION",
                scheduleId: null,
                totalAmount: "1234567.00",
              },
            ],
            individuals: [],
            transfers: [],
          },
        ],
      }}
    />,
  );
  expect(html).toContain("기타 · 1,234,567.00 USD");
  expect(html).toContain("여행 준비 · 1,234,567.00 USD");
});
it("renders exact server split and transfers including unknown people, no recalculation", () => {
  const html = renderToStaticMarkup(
    <ExpenseSummaryView
      members={[]}
      memberStatus="success"
      schedules={[]}
      summary={{
        currencies: [
          {
            currency: "USD",
            totalAmount: "10.01",
            individuals: [
              {
                userId: 1,
                paidAmount: "5.01",
                owedAmount: "3.34",
                netAmount: "1.67",
              },
              {
                userId: 2,
                paidAmount: "5.00",
                owedAmount: "3.34",
                netAmount: "1.66",
              },
              {
                userId: 3,
                paidAmount: "0.00",
                owedAmount: "3.33",
                netAmount: "-3.33",
              },
            ],
            transfers: [
              { fromUserId: 3, toUserId: 1, amount: "1.67" },
              { fromUserId: 3, toUserId: 2, amount: "1.66" },
            ],
            categories: [{ category: "OTHER", totalAmount: "10.01" }],
            days: [
              {
                expenseGroup: "PREPARATION",
                scheduleId: null,
                totalAmount: "10.01",
              },
            ],
          },
        ],
      }}
    />,
  );
  for (const text of [
    "5.01",
    "5.00",
    "3.34",
    "3.33",
    "1.67",
    "1.66",
    "(알 수 없음)",
    "사용자 정보를 확인할 수 없어요",
    "기타",
    "여행 준비",
    "송금 제안",
  ])
    expect(html).toContain(text);
  expect(html).toContain('data-user-id="1"');
  expect(html).toContain('data-user-id="2"');
  expect(html).not.toContain("정산 완료");
});
it("keeps list amounts and IDs while members are loading or failed, and hides CRUD", () => {
  for (const memberStatus of ["pending", "error"] as const) {
    const html = renderToStaticMarkup(
      <ExpenseList
        expenses={[expense]}
        members={[]}
        memberStatus={memberStatus}
        schedules={[]}
        canManage={false}
        onEdit={() => {}}
        onDelete={() => {}}
        busy={false}
      />,
    );
    expect(html).toContain("10.01");
    expect(html).not.toContain("(알 수 없음)");
    expect(html).not.toContain(">수정<");
  }
});
it("offers only selected original unknown in role and labels LEFT", () => {
  const members = [
    {
      userId: 2,
      status: "LEFT" as const,
      role: "MEMBER" as const,
      nickname: "둘",
      profileImageUrl: null,
      joinedAt: "",
      isOnline: false,
    },
    {
      userId: 3,
      status: "PENDING" as const,
      role: "MEMBER" as const,
      nickname: "대기",
      profileImageUrl: null,
      joinedAt: "",
      isOnline: false,
    },
  ];
  const html = renderToStaticMarkup(
    <ExpenseRolePicker
      title="결제자"
      members={members}
      selected={[2, 99]}
      original={[99]}
      onChange={() => {}}
    />,
  );
  expect(html).toContain("나간 멤버");
  expect(html).toContain("(알 수 없음)");
  expect(html).not.toContain("대기");
  expect(html).toContain("다시 추가할 수 없어요");
});

const categories = [
  ["FLIGHT", "항공"],
  ["ACCOMMODATION", "숙박"],
  ["FOOD", "식사"],
  ["TRANSPORT", "교통"],
  ["SHOPPING", "쇼핑"],
  ["SIGHTSEEING", "관광"],
  ["OTHER", "기타"],
] as const;
it.each(categories)("labels listed %s expenses as %s", (category, label) => {
  const html = renderToStaticMarkup(
    <ExpenseList
      expenses={[{ ...expense, category }]}
      members={[]}
      memberStatus="success"
      schedules={[]}
      canManage
      onEdit={() => {}}
      onDelete={() => {}}
      busy={false}
    />,
  );
  expect(html).toContain(label);
  if (category !== "OTHER") expect(html).not.toContain("기타");
});
it("renders the server category order and exact amounts, omitting unused categories", () => {
  const render = (rows: (typeof categories)[number][]) =>
    renderToStaticMarkup(
      <ExpenseSummaryView
        members={[]}
        memberStatus="success"
        schedules={[]}
        summary={{
          currencies: [
            {
              currency: "USD",
              totalAmount: "280.07",
              individuals: [],
              transfers: [],
              days: [],
              categories: rows.map(([category], index) => ({
                category,
                totalAmount: `${(index + 1) * 10}.01`,
              })),
            },
          ],
        }}
      />,
    );
  const html = render([...categories]);
  let previous = -1;
  for (const [index, [, label]] of categories.entries()) {
    const position = html.indexOf(`${label} · ${(index + 1) * 10}.01 USD`);
    expect(
      position,
      `${label} follows the previous server category`,
    ).toBeGreaterThan(previous);
    previous = position;
  }
  const subset = render([categories[2], categories[6]]);
  expect(subset).toContain("식사 · 10.01 USD");
  expect(subset).toContain("기타 · 20.01 USD");
  for (const index of [0, 1, 3, 4, 5])
    expect(subset).not.toContain(categories[index][1]);
});
