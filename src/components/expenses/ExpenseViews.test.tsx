import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import {
  ExpenseList,
  ExpenseSummaryView,
  ExpenseAnalysisView,
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
  version: 0,
  createdAt: "",
  updatedAt: "",
};

it("groups category and daily totals without losing decimal precision", () => {
  const html = renderToStaticMarkup(
    <ExpenseAnalysisView
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
  expect(html).not.toContain("여행 준비 · 1,234,567.00 USD");
});
it("renders exact server split and transfers including unknown people, no recalculation", () => {
  const html = renderToStaticMarkup(
    <ExpenseSummaryView scope="all"
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
    "전체 정산",
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
      <ExpenseAnalysisView
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

const personalSummary = {
  currencies: [{
    currency: "KRW", totalAmount: "90000", categories: [], days: [],
    individuals: [{ userId: 1, paidAmount: "20000", owedAmount: "50000", netAmount: "-30000" }],
    transfers: [
      { fromUserId: 1, toUserId: 2, amount: "30000" },
      { fromUserId: 3, toUserId: 4, amount: "10000" },
    ],
  }, {
    currency: "USD", totalAmount: "12.34", categories: [], days: [],
    individuals: [{ userId: 1, paidAmount: "12.34", owedAmount: "0.00", netAmount: "12.34" }],
    transfers: [{ fromUserId: 2, toUserId: 1, amount: "12.34" }],
  }],
};
it("defaults to my settlement, showing only my counterparties and separate currencies", () => {
  const html = renderToStaticMarkup(<ExpenseSummaryView summary={personalSummary} members={[]} memberStatus="success" schedules={[]} currentUserId={1} />);
  expect(html).toContain("보낼 금액");
  expect(html).toContain("받을 금액");
  expect(html).toContain("30,000 KRW");
  expect(html).toContain("12.34 USD");
  expect(html).not.toContain('data-user-id="3"');
  expect(html).not.toContain('data-user-id="4"');
  expect(html).not.toContain("순액");
  expect(html).toContain("계산 내역");
  expect(html).toContain("내가 낸 금액");
  expect(html).toContain("내 몫");
  expect(html).not.toContain("지출 분석");
});
it("does not claim settlement completion when there are no personal transfers", () => {
  const html = renderToStaticMarkup(<ExpenseSummaryView summary={personalSummary} members={[]} memberStatus="success" schedules={[]} currentUserId={5} />);
  expect(html).toContain("주고받을 금액이 없어요");
  expect(html).not.toContain("정산 완료");
});
it("does not show other people's transfers while the current user is unavailable", () => {
  const html = renderToStaticMarkup(<ExpenseSummaryView summary={personalSummary} members={[]} memberStatus="pending" schedules={[]} />);
  expect(html).toContain("내 정산을 확인할 사용자 정보를 불러오는 중");
  expect(html).not.toContain("30,000 KRW");
});

it("scales analysis bars against the largest amount and handles zero totals", () => {
  const render = (amounts: string[]) => renderToStaticMarkup(
    <ExpenseAnalysisView members={[]} memberStatus="success" schedules={[]} summary={{ currencies: [{
      currency: "USD", totalAmount: "150.00", individuals: [], transfers: [], days: [],
      categories: amounts.map((totalAmount, i) => ({ category: i === 0 ? "FOOD" : "OTHER", totalAmount })),
    }] }} />,
  );
  const html = render(["100.00", "50.00"]);
  expect(html).toContain('width:100%');
  expect(html).toContain('width:50%');
  const opacities = [...html.matchAll(/opacity:([0-9.]+)/g)].map(match => Number(match[1]));
  expect(opacities[0]).toBeGreaterThan(opacities[1]);
  const equal = [...render(["50", "50"]).matchAll(/opacity:([0-9.]+)/g)].map(match => Number(match[1]));
  expect(equal[0]).toBe(equal[1]);
  expect(html).toContain('aria-label="USD 카테고리별 지출 그래프"');
  const zero = render(["0.00", "0.00"]);
  expect(zero).not.toMatch(/NaN|Infinity/);
  expect(zero).toContain('width:0%');
});

it("shows only the selected analysis graph and preserves exact daily amounts", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(<ExpenseAnalysisView members={[]} memberStatus="success" schedules={[]} summary={{ currencies: [{
        currency: "USD", totalAmount: "1234567.00", individuals: [], transfers: [],
        categories: [{ category: "OTHER", totalAmount: "1234567.00" }],
        days: [{ expenseGroup: "PREPARATION", scheduleId: null, totalAmount: "1234567.00" }],
      }] }} />);
    });
    const graphs = () => renderer!.root.findAllByType("figure");
    expect(graphs()).toHaveLength(1);
    expect(graphs()[0].props["aria-label"]).toBe("USD 카테고리별 지출 그래프");
    await act(async () => renderer!.root.findAllByType("button").find(b => b.children.includes("일차별"))!.props.onClick());
    expect(graphs()).toHaveLength(1);
    expect(graphs()[0].props["aria-label"]).toBe("USD 준비·일차별 지출 그래프");
    expect(JSON.stringify(renderer!.toJSON())).toContain("여행 준비 · 1,234,567.00 USD");
    await act(async () => renderer!.root.findAllByType("button").find(b => b.children.includes("카테고리별"))!.props.onClick());
    expect(graphs()).toHaveLength(1);
    expect(graphs()[0].props["aria-label"]).toBe("USD 카테고리별 지출 그래프");
  } finally {
    await act(async () => renderer?.unmount());
    vi.unstubAllGlobals();
  }
});

it("opens editing from the expense card and keeps deletion as a separate action", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let renderer: ReactTestRenderer | undefined;
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const render = (canManage: boolean, busy = false) => <ExpenseList expenses={[expense]} members={[]} memberStatus="success" schedules={[]} canManage={canManage} busy={busy} onEdit={onEdit} onDelete={onDelete} />;
  try {
    await act(async () => { renderer = create(render(true)); });
    expect(renderer!.root.findAllByType("details")).toHaveLength(1);
    expect(JSON.stringify(renderer!.toJSON())).toContain("결제자");
    expect(JSON.stringify(renderer!.toJSON())).toContain("부담자");
    const buttons = renderer!.root.findAllByType("button");
    expect(buttons).toHaveLength(2);
    await act(async () => buttons.find(b => b.props["aria-label"].endsWith("지출 수정"))!.props.onClick());
    expect(onEdit).toHaveBeenCalledWith(expense);
    onEdit.mockClear();
    await act(async () => buttons.find(b => b.props["aria-label"] === "지출 삭제")!.props.onClick());
    expect(onDelete).toHaveBeenCalledWith(expense);
    expect(onEdit).not.toHaveBeenCalled();
    await act(async () => renderer!.update(render(true, true)));
    expect(renderer!.root.findAllByType("button").every(b => b.props.disabled)).toBe(true);
    await act(async () => renderer!.update(render(false)));
    expect(renderer!.root.findAllByType("button")).toHaveLength(0);
  } finally {
    await act(async () => renderer?.unmount());
    vi.unstubAllGlobals();
  }
});
