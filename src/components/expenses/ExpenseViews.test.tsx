// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import {
  ExpenseList,
  ExpenseSummaryView,
  ExpenseAnalysisView,
  ExpenseRolePicker,
} from "./ExpenseViews";
// 메뉴·탭은 Base UI라 react-dom으로 그리고 document에서 찾는다(메뉴 목록은 body로 포털된다)
async function renderInDom(node: ReactNode) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(node));
  return {
    host,
    rerender: (next: ReactNode) => act(async () => root.render(next)),
    cleanup: async () => {
      await act(async () => root.unmount());
      host.remove();
      vi.unstubAllGlobals();
    },
  };
}
// Base UI는 메뉴를 닫은 뒤 다음 틱에 목록을 지운다
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const menuItem = (label: string) =>
  document.querySelector<HTMLElement>(`[role="menuitem"][aria-label="${label}"]`);
async function press(element: HTMLElement) {
  await act(async () => element.click());
  await flush();
}
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
  name: null, createdAt: "",
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
  ["FOOD", "식비"],
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
  expect(subset).toContain("식비 · 10.01 USD");
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
  const html = renderToStaticMarkup(<ExpenseSummaryView summary={personalSummary} members={[]} memberStatus="success" currentUserId={1} />);
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
  expect(html).not.toContain("비용 분석");
});
it("does not claim settlement completion when there are no personal transfers", () => {
  const html = renderToStaticMarkup(<ExpenseSummaryView summary={personalSummary} members={[]} memberStatus="success" currentUserId={5} />);
  expect(html).toContain("주고받을 금액이 없어요");
  expect(html).not.toContain("정산 완료");
});
it("does not show other people's transfers while the current user is unavailable", () => {
  const html = renderToStaticMarkup(<ExpenseSummaryView summary={personalSummary} members={[]} memberStatus="pending" />);
  expect(html).toContain('aria-label="내 정산 사용자 정보 불러오는 중"');
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
  expect(html).toContain('aria-label="USD 카테고리별 비용 그래프"');
  const zero = render(["0.00", "0.00"]);
  expect(zero).not.toMatch(/NaN|Infinity/);
  expect(zero).toContain('width:0%');
});

it("shows only the selected analysis graph and preserves exact daily amounts", async () => {
  const view = await renderInDom(<ExpenseAnalysisView members={[]} memberStatus="success" schedules={[]} summary={{ currencies: [{
    currency: "USD", totalAmount: "1234567.00", individuals: [], transfers: [],
    categories: [{ category: "OTHER", totalAmount: "1234567.00" }],
    days: [{ expenseGroup: "PREPARATION", scheduleId: null, totalAmount: "1234567.00" }],
  }] }} />);
  try {
    const graphs = () => [...view.host.querySelectorAll("figure")].map(figure => figure.getAttribute("aria-label"));
    // 분석 기준은 Tabs(role="tab", aria-selected)다
    const tab = (label: string) => [...view.host.querySelectorAll<HTMLElement>('[role="tab"]')].find(t => t.textContent === label)!;
    expect(view.host.querySelector('[role="tablist"]')?.getAttribute("aria-label")).toBe("비용 분석 기준");
    expect(tab("카테고리별").getAttribute("aria-selected")).toBe("true");
    expect(graphs()).toEqual(["USD 카테고리별 비용 그래프"]);
    await press(tab("일차별"));
    expect(tab("일차별").getAttribute("aria-selected")).toBe("true");
    expect(tab("카테고리별").getAttribute("aria-selected")).toBe("false");
    expect(graphs()).toEqual(["USD 준비·일차별 비용 그래프"]);
    expect(view.host.innerHTML).toContain("여행 준비 · 1,234,567.00 USD");
    await press(tab("카테고리별"));
    expect(graphs()).toEqual(["USD 카테고리별 비용 그래프"]);
  } finally {
    await view.cleanup();
  }
});

it("opens editing from the expense card and keeps deletion as a separate action", async () => {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const render = (canManage: boolean, busy = false) => <ExpenseList expenses={[expense]} members={[]} memberStatus="success" schedules={[]} canManage={canManage} busy={busy} onEdit={onEdit} onDelete={onDelete} />;
  const view = await renderInDom(render(true));
  try {
    expect(view.host.querySelectorAll("details")).toHaveLength(0);
    expect(view.host.textContent).toContain("결제");
    expect(view.host.textContent).toContain("분담");
    const more = () => [...view.host.querySelectorAll<HTMLButtonElement>("button")].find(b => b.getAttribute("aria-label")?.endsWith("비용 더보기"))!;
    await press(more());
    await press(menuItem("비용 수정")!);
    expect(onEdit).toHaveBeenCalledWith(expense);
    onEdit.mockClear();
    await press(more());
    await press(menuItem("비용 삭제")!);
    expect(onDelete).toHaveBeenCalledWith(expense);
    expect(onEdit).not.toHaveBeenCalled();
    await view.rerender(render(true, true));
    const buttons = [...view.host.querySelectorAll<HTMLButtonElement>("button")];
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every(b => b.disabled)).toBe(true);
    await view.rerender(render(false));
    expect(view.host.querySelectorAll("button")).toHaveLength(0);
  } finally {
    await view.cleanup();
  }
});

it("announces unavailable identity before an empty personal settlement", () => {
  const html = renderToStaticMarkup(<ExpenseSummaryView summary={{ currencies: [] }} members={[]} memberStatus="pending" />);
  expect(html).toContain('<output');
  expect(html).toContain('aria-label="내 정산 사용자 정보 불러오는 중"');
  expect(html).not.toContain("정산할 비용이 없어요.");
});

it("opens a more disclosure before delete and uses category instead of memo as the name", async () => {
  const onDelete = vi.fn();
  const view = await renderInDom(<ExpenseList expenses={[expense]} members={[]} memberStatus="success" schedules={[]} canManage busy={false} onEdit={vi.fn()} onDelete={onDelete} />);
  try {
    expect(menuItem("비용 삭제")).toBeNull();
    const more = view.host.querySelector<HTMLButtonElement>('button[aria-label="기타 비용 더보기"]');
    expect(more).not.toBeNull();
    await press(more!);
    await press(menuItem("비용 삭제")!);
    expect(onDelete).toHaveBeenCalledWith(expense);
    expect(menuItem("비용 삭제")).toBeNull();
  } finally {
    await view.cleanup();
  }
});
