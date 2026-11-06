// @vitest-environment jsdom
vi.mock("@/lib/api/config", () => ({ API_BASE: "http://fixture" }));
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ExpenseApiError, type Expense } from "@/lib/api/rooms/expenses";
import { ExpensePanel } from "./ExpensePanel";
import contractFixture from "./krw-contract.fixture.json";

const mocks = vi.hoisted(() => ({
  state: null as unknown,
  remove: vi.fn(),
  readLatest: vi.fn(),
  open: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("./ExpenseProvider", () => ({
  useExpenseContext: () => mocks.state,
  ExpenseEntryButton: () => <button>준비 비용 추가</button>,
}));

// 메뉴·정산 요약 대화상자·삭제 확인창은 Base UI라 body로 포털된다. react-dom으로 그리고 document에서 찾는다
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function mount() {
  const base = {
    version: 0,
    currency: "KRW",
    totalAmount: "100",
    category: "OTHER",
    scheduleItemId: null,
    memo: "",
    payerUserIds: [1],
    participantUserIds: [1],
    createdAt: "",
    updatedAt: "",
  };
  mocks.state = {
    members: [],
    memberStatus: "success",
    syncStatus: "ready",
    canManage: true,
    schedules: [{ scheduleId: 10, dayNumber: 1 }],
    list: {
      isSuccess: true,
      isError: false,
      isPending: false,
      data: [
        {
          ...base,
          id: 1,
          expenseGroup: "PREPARATION",
          scheduleId: null,
          memo: "준비",
        },
        {
          ...base,
          id: 2,
          expenseGroup: "TRIP_DAY",
          scheduleId: 10,
          memo: "현장",
        },
      ],
    },
    summary: { isSuccess: true, data: { currencies: [] } },
    budget: {
      isSuccess: true,
      data: { budgetKrw: "1000", currency: "KRW", version: 0 },
    },
    krwSummary: {
      isSuccess: true,
      data: {
        originalTotals: [],
        convertedTotalKrw: "501",
        rateDate: "2026-09-11",
        rateSource: "ECB",
        stale: false,
        missingCurrencies: [],
        isComplete: true,
      },
    },
    budgetBusy: false,
    busy: false,
    open: mocks.open,
    remove: mocks.remove,
    readLatest: mocks.readLatest,
    refresh: mocks.refresh,
  };
  mocks.remove.mockReset();
  mocks.readLatest.mockReset();
  await rerender();
}
async function rerender() {
  await act(async () => root.render(<ExpensePanel />));
}
// Base UI는 열고 닫은 뒤 포커스 이동·언마운트를 다음 틱에 한다
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

// 접근성 이름: aria-labelledby(Button loading이면 loadingLabel span) → aria-label → 글자
function accessibleName(element: Element) {
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy)
    return labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
  return element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";
}
function buttonsIn(scope: ParentNode = document) {
  return [...scope.querySelectorAll<HTMLElement>('button, [role="menuitem"]')];
}
function button(name: string, scope: ParentNode = document) {
  return buttonsIn(scope).find((element) => accessibleName(element) === name);
}
async function press(name: string, scope: ParentNode = document) {
  const target = button(name, scope);
  expect(target, `button: ${name}`).toBeDefined();
  await act(async () => target!.click());
  await flush();
}
const text = () => document.body.textContent ?? "";
const rows = () => host.querySelectorAll("li");
const expenseRows = (id: number) => host.querySelectorAll(`[data-expense-id="${id}"]`);
const summaryDialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const confirmDialog = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
const selectedTotal = () => host.querySelector<HTMLElement>('[aria-label="선택한 비용 합계"]')!;
// ExpenseKrwAmount는 원화 합계가 아직 없으면 '원화 금액 확인 중' 대시를 그린다
const krwPending = (scope: Element) => scope.querySelector('[aria-label="원화 금액 확인 중"]') !== null;

async function openFirstMenu() {
  const trigger = buttonsIn(host).find((element) => element.getAttribute("aria-label")?.endsWith("비용 더보기"));
  expect(trigger).toBeDefined();
  await act(async () => trigger!.click());
  await flush();
}
async function answerConfirm(confirmed: boolean) {
  const dialog = confirmDialog();
  expect(dialog).not.toBeNull();
  await press(confirmed ? "삭제" : "취소", dialog!);
}
async function chooseCategory(label: string) {
  const trigger = host.querySelector<HTMLElement>('[role="combobox"][aria-label="카테고리 필터"]');
  expect(trigger).not.toBeNull();
  await act(async () => trigger!.click());
  await flush();
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((node) => node.textContent === label);
  expect(option, `option: ${label}`).toBeDefined();
  await act(async () => option!.click());
  await flush();
}

it("opens an expense in the selected trip day", async () => {
  await mount();
  mocks.open.mockClear();
  await press("Day 1 비용");
  await press("비용 추가");
  expect(mocks.open).toHaveBeenCalledWith({ scheduleId: 10 });
});

it("keeps a single reference travel total visible while filtering", async () => {
  await mount();
  mocks.state = {
    ...(mocks.state as object),
    summary: {
      isSuccess: true,
      data: {
        currencies: [
          {
            currency: "USD",
            totalAmount: "999999999999999.99",
            categories: [],
            days: [],
            individuals: [],
            transfers: [],
          },
          {
            currency: "KRW",
            totalAmount: "12300",
            categories: [],
            days: [],
            individuals: [],
            transfers: [],
          },
        ],
      },
    },
  };
  await rerender();
  await press("여행 준비 비용");
  expect(text()).not.toContain("999,999,999,999,999.99");
  expect(text()).not.toContain("12,300");
  expect(text()).toContain("501");
  expect(text().match(/여행 전체 비용/g)).toHaveLength(1);
  expect(text()).not.toContain("원화 참고 비용");
});

it("filters preparation and trip day without altering server summary scope", async () => {
  await mount();
  await press("여행 준비 비용");
  expect(rows()).toHaveLength(1);
  expect(host.textContent).toContain("준비");
  expect(host.textContent).not.toContain("현장");
  await press("정산 요약");
  expect(summaryDialog()).not.toBeNull();
  expect(text()).not.toContain("방 전체 비용을 기준으로 정산해요.");
});

it("requires confirmation and preserves list with visible deletion failure", async () => {
  await mount();
  await openFirstMenu();
  await press("비용 삭제");
  await answerConfirm(false);
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(confirmDialog()).toBeNull();
  mocks.remove.mockRejectedValue(new Error("삭제 실패"));
  await openFirstMenu();
  await press("비용 삭제");
  await answerConfirm(true);
  expect(confirmDialog()).toBeNull();
  expect(host.textContent).toContain("삭제 실패");
  expect(rows()).toHaveLength(2);
});

it("returns to all expenses when the selected day is deleted remotely", async () => {
  await mount();
  await press("Day 1 비용");
  const state = mocks.state as { list: { data: { id: number }[] } };
  mocks.state = {
    ...state,
    schedules: [],
    list: {
      ...state.list,
      isSuccess: true,
      data: state.list.data.filter((e) => e.id === 1),
    },
  };
  await rerender();
  expect(button("전체 비용")?.getAttribute("aria-pressed")).toBe("true");
  expect(rows()).toHaveLength(1);
});

it("retains deletion selection and requires confirmation of the fetched version without automatic retry", async () => {
  await mount();
  const state = mocks.state as { list: { data: Expense[] } };
  const latest = {
    ...state.list.data[0],
    version: 3,
    memo: "remote delete review",
  };
  mocks.remove.mockRejectedValueOnce(
    new ExpenseApiError(409, "EXPENSE_CONFLICT", "changed"),
  );
  mocks.readLatest.mockResolvedValueOnce(latest);
  await openFirstMenu();
  await press("비용 삭제");
  await answerConfirm(true);
  expect(mocks.readLatest).toHaveBeenCalledWith(1);
  expect(mocks.remove).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain("remote delete review");
  mocks.state = {
    ...state,
    list: {
      ...state.list,
      data: [{ ...latest, version: 4 }, state.list.data[1]],
    },
  };
  await rerender();
  await press("최신 비용 확인 후 삭제");
  await answerConfirm(false);
  expect(mocks.remove).toHaveBeenCalledTimes(1);
  await press("최신 비용 확인 후 삭제");
  await answerConfirm(true);
  expect(mocks.remove).toHaveBeenLastCalledWith(latest);
});

it.each(["missing", "offline"])(
  "does not retry delete when recovery is %s",
  async (mode) => {
    await mount();
    mocks.remove.mockRejectedValueOnce(
      new ExpenseApiError(409, "EXPENSE_CONFLICT", "changed"),
    );
    if (mode === "missing") mocks.readLatest.mockResolvedValueOnce(undefined);
    else mocks.readLatest.mockRejectedValueOnce(new Error("offline"));
    await openFirstMenu();
    await press("비용 삭제");
    await answerConfirm(true);
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    expect(button("최신 비용 확인 후 삭제")).toBeUndefined();
  },
);

it("keeps budget and original-currency settlement without comparison or explanatory copy", async () => {
  await mount();
  mocks.state = {
    ...(mocks.state as object),
    currentUserId: 1,
    summary: {
      isSuccess: true,
      data: {
        currencies: [
          {
            currency: "USD",
            totalAmount: "1.00",
            individuals: [],
            categories: [],
            days: [],
            transfers: [{ fromUserId: 1, toUserId: 2, amount: "0.50" }],
          },
          {
            currency: "KRW",
            totalAmount: "1000",
            individuals: [],
            categories: [],
            days: [],
            transfers: [{ fromUserId: 2, toUserId: 1, amount: "500" }],
          },
        ],
      },
    },
  };
  await rerender();
  expect(host.textContent).toContain("전체 예산");
  expect(document.querySelectorAll('[aria-label="예산 비교"]')).toHaveLength(0);
  await press("정산 요약");
  const dialog = summaryDialog()!;
  expect(dialog.textContent).toContain("USD 0.50");
  expect(dialog.querySelector('[aria-label="KRW 정산"]')?.textContent).toContain("500");
  expect(text()).not.toContain("참고 잔여 예산");
  expect(text()).not.toContain("통화별로 따로 정산");
  expect(text()).not.toContain("아래 금액을 확인하고 직접 송금");
});

it("closes the expense panel after room access is revoked", async () => {
  await mount();
  mocks.state = { ...(mocks.state as object), revoked: true };
  await rerender();
  expect(host.childElementCount).toBe(0);
});

it.each(["ready", "pending", "disconnected"])(
  "does not offer a manual expense refresh while sync is %s",
  async (syncStatus) => {
    await mount();
    mocks.state = { ...(mocks.state as object), syncStatus };
    await rerender();
    expect(buttonsIn().filter((element) =>
      /새로고침|조회 다시 시도/.test(accessibleName(element)),
    )).toHaveLength(0);
    expect(text()).not.toContain("새로고침");
    if (syncStatus === "disconnected") expect(text()).toContain("연결 복구 안내");
    if (syncStatus === "pending") expect(text()).toContain("최신 비용 확인 중");
  },
);

it.each(["sync", "members", "list", "summary", "budget", "krwSummary"])(
  "offers a retry only until the failed %s read recovers",
  async (failed) => {
    await mount();
    const healthy = mocks.state as Record<string, unknown>;
    mocks.state = {
      ...healthy,
      ...(failed === "sync" ? { syncStatus: "error" }
        : failed === "members" ? { memberStatus: "error", canManage: false }
        : { [failed]: { ...(healthy[failed] as object), isSuccess: false, isError: true } }),
    };
    await rerender();
    expect(text()).not.toContain("새로고침");
    const retry = () => buttonsIn(host).find((element) => /조회 다시 시도/.test(accessibleName(element)));
    expect(retry()).toBeDefined();
    let finish!: () => void;
    mocks.refresh.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    await act(async () => retry()!.click());
    // 패널(대화상자 밖) 재시도는 문구와 native disabled로 진행을 보인다
    expect((retry() as HTMLButtonElement).disabled).toBe(true);
    expect(accessibleName(retry()!)).toBe("조회 다시 시도 중");
    await act(async () => { mocks.state = healthy; finish(); });
    expect(retry()).toBeUndefined();
  },
);

it.each(["initial load", "change", "reconnect"])(
  "removes the top success explanation and its layout slot after %s succeeds",
  async (scenario) => {
    await mount();
    const healthy = mocks.state as object;
    if (scenario !== "initial load") {
      mocks.state = {
        ...healthy,
        syncStatus: scenario === "reconnect" ? "disconnected" : "pending",
      };
      await rerender();
      expect(text()).toContain(
        scenario === "reconnect" ? "연결 복구 안내" : "최신 비용 확인 중",
      );
      mocks.state = healthy;
      await rerender();
    }
    const section = host.querySelector('section[aria-label="비용 및 정산"]')!;
    const first = section.firstElementChild!;
    expect([...first.querySelectorAll("h1")].map((heading) => heading.textContent))
      .toEqual(["가계부"]);
    expect(text()).not.toMatch(/최근 비용 조회 완료|30초 간격/);
  },
);

it("opens the whole-trip settlement without extra analysis or scope menus", async () => {
  await mount();
  mocks.state = {
    ...(mocks.state as object), currentUserId: 1,
    summary: { isSuccess: true, data: { currencies: [{
      currency: "KRW", totalAmount: "12345", individuals: [], days: [],
      categories: [{ category: "FOOD", totalAmount: "12345" }],
      transfers: [{ fromUserId: 3, toUserId: 4, amount: "12345" }],
    }] } },
  };
  await rerender();
  await press("정산 요약");
  expect(summaryDialog()?.textContent).toContain("12,345");
  const labels = [...document.querySelectorAll('button, [role="tab"]')].map(accessibleName);
  expect(labels).not.toContain("비용 분석");
  expect(labels).not.toContain("내 정산");
  expect(document.querySelector('[role="tablist"]')).toBeNull();
  expect(text()).not.toContain("정산 보기 옵션");
});

it.each([
  ["disconnected", "실시간 연결이 끊겼어요."],
  ["error", "최신 상태 확인에 실패했어요."],
  ["pending", "최신 비용 확인 중…"],
])("announces %s sync status with a native block output", async (syncStatus, message) => {
  await mount();
  mocks.state = { ...(mocks.state as object), syncStatus };
  await rerender();
  const output = [...host.querySelectorAll("output")].find((node) => node.textContent?.startsWith(message));
  expect(output).toBeDefined();
  expect(output!.style.display).toBe("block");
});

it("intersects day and category filters while keeping the trip budget visible", async () => {
  await mount();
  const state = mocks.state as { list: { data: Expense[] } };
  mocks.state = { ...state, list: { ...state.list, data: [
    { ...state.list.data[0], category: "FOOD" },
    { ...state.list.data[1], category: "OTHER" },
  ] } };
  await rerender();
  await chooseCategory("식비");
  expect(expenseRows(1)).toHaveLength(1);
  expect(expenseRows(2)).toHaveLength(0);
  await press("Day 1 비용");
  expect(expenseRows(1)).toHaveLength(0);
  expect(host.textContent).toContain("501");
});

it("can retry a failed summary from inside its modal", async () => {
  await mount();
  mocks.refresh.mockClear();
  mocks.state = { ...(mocks.state as object), summary: { isError: true, isSuccess: false } };
  await rerender();
  await press("정산 요약");
  const dialog = summaryDialog()!;
  expect(button("조회 다시 시도", dialog)).toBeDefined();
  await press("조회 다시 시도", dialog);
  expect(mocks.refresh).toHaveBeenCalledOnce();
});

it("shows retry progress in the summary modal button while the panel retry stays natively disabled", async () => {
  await mount();
  mocks.refresh.mockReset();
  mocks.state = { ...(mocks.state as object), summary: { isError: true, isSuccess: false } };
  await rerender();
  await press("정산 요약");
  const dialog = summaryDialog()!;
  let finish!: () => void;
  mocks.refresh.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  await press("조회 다시 시도", dialog);
  // 대화상자 안 버튼은 progress(loading): 접근성 이름은 loadingLabel, 포커스는 남고 native disabled 대신 aria-disabled
  const modalRetry = button("조회 다시 시도 중", dialog) as HTMLButtonElement;
  expect(modalRetry).toBeDefined();
  expect(modalRetry.getAttribute("aria-busy")).toBe("true");
  expect(modalRetry.getAttribute("aria-disabled")).toBe("true");
  expect(modalRetry.disabled).toBe(false);
  // 패널(대화상자 밖) 재시도는 지금처럼 문구가 바뀌고 native disabled
  const panelRetry = button("조회 다시 시도 중", host) as HTMLButtonElement;
  expect(panelRetry).toBeDefined();
  expect(panelRetry.disabled).toBe(true);
  expect(panelRetry.hasAttribute("aria-busy")).toBe(false);
  expect(panelRetry.textContent).toContain("조회 다시 시도 중");
  // 진행 중에 다시 눌러도 요청은 한 번이다
  await act(async () => modalRetry.click());
  expect(mocks.refresh).toHaveBeenCalledOnce();
  await act(async () => finish());
  expect(button("조회 다시 시도", dialog)?.hasAttribute("aria-busy")).toBe(false);
  expect(button("조회 다시 시도", host)).toBeDefined();
});

it("renders a complete filtered snapshot independently of a partial whole room and hides it on filter transition", async () => {
  await mount();
  const whole = { ...contractFixture.response, convertedTotalKrw: "508", isComplete: false, missingCurrencies: ["KWD"], stale: true };
  const selected = { ...whole, filtered: { ...contractFixture.response.filtered, convertedTotalKrw: "501" }, expenses: [contractFixture.response.expenses[0]] };
  const setKrwFilters = vi.fn();
  mocks.state = { ...(mocks.state as object), krwSummary: { data: whole, isSuccess: true },
    krwFilters: {}, setKrwFilters, filteredKrwSummary: { data: selected, isSuccess: true } };
  await rerender();
  expect(selectedTotal().textContent).toContain("501원");
  expect(selectedTotal().textContent).not.toContain("508원");
  // 방 전체 합계는 부분 합계(508원)와 원화 합계 안내를 함께 보여 준다
  const wholeAmount = [...host.querySelectorAll("span")].find((span) => span.textContent === "508원");
  expect(wholeAmount?.parentElement?.querySelector('button[aria-label="원화 합계 안내"]')).not.toBeNull();
  await press("Day 1 비용");
  expect(setKrwFilters).toHaveBeenLastCalledWith({ expenseGroup: "TRIP_DAY", scheduleId: 10 });
  expect(krwPending(selectedTotal())).toBe(true);
  expect(selectedTotal().textContent).not.toContain("501원");
});

it("keeps known row and day KRW amounts while a new filtered total loads without mixing category scopes", async () => {
  await mount();
  const current = mocks.state as { list: { data: Expense[] }; krwSummary: { data: typeof contractFixture.response } };
  const row = { ...current.list.data[1], category: "FOOD" as const };
  const dayTotal = { convertedTotalKrw: "13500", isComplete: true, missingCurrencies: [], originalTotals: [] };
  const whole = { ...current.krwSummary.data, expenses: [{ expense: row, convertedAmountKrw: "13500", isComplete: true, missingCurrencies: [] }], days: [{ expenseGroup: "TRIP_DAY", scheduleId: 10, total: dayTotal }] };
  mocks.state = { ...(mocks.state as object), list: { isSuccess: true, data: [row] }, krwSummary: { isSuccess: true, data: whole }, filteredKrwSummary: { isPending: true, isFetching: true }, krwFilters: {} };
  await rerender();
  await press("Day 1 비용");
  expect(selectedTotal().textContent).toContain("13,500원");
  expect(host.textContent).toContain("13,500원");
  expect(text()).not.toContain("최신 비용 확인 중");
  await chooseCategory("식비");
  expect(krwPending(selectedTotal())).toBe(true);
  expect(selectedTotal().textContent).not.toContain("13,500원");
  expect(host.textContent).toContain("13,500원");
});

it("keeps the visible ledger unchanged during background tab-return reads", async () => {
  await mount();
  const healthy = { ...(mocks.state as Record<string, unknown>), list: { isSuccess: true, data: contractFixture.response.expenses.map((row) => row.expense) }, krwSummary: { data: contractFixture.response, isSuccess: true }, krwFilters: {}, filteredKrwSummary: { data: contractFixture.response, isSuccess: true } };
  mocks.state = healthy;
  await rerender();
  const before = host.innerHTML;
  mocks.state = { ...healthy, syncStatus: "refreshing", list: { ...healthy.list, isFetching: true }, krwSummary: { ...healthy.krwSummary, isFetching: true }, filteredKrwSummary: { ...healthy.filteredKrwSummary, isFetching: true } };
  await rerender();
  expect(host.innerHTML).toBe(before);
});

it("switches category rows and day totals together without an intermediate currency fallback", async () => {
  await mount();
  const current = mocks.state as { list: { data: Expense[] }; krwSummary: { data: typeof contractFixture.response } };
  const food = { ...current.list.data[1], category: "FOOD" as const };
  const other = { ...food, id: 99, category: "OTHER" as const };
  const total = { convertedTotalKrw: "200", isComplete: true, missingCurrencies: [], originalTotals: [] };
  const whole = { ...current.krwSummary.data, expenses: [food, other].map((expense) => ({ expense, convertedAmountKrw: "100", isComplete: true, missingCurrencies: [] })), days: [{ expenseGroup: "TRIP_DAY", scheduleId: 10, total }] };
  mocks.state = { ...(mocks.state as object), list: { isSuccess: true, data: [food, other] }, krwSummary: { isSuccess: true, data: whole }, krwFilters: {}, setKrwFilters: vi.fn(), filteredKrwSummary: { isPending: true, isFetching: true } };
  await rerender();
  // 일차 묶음의 제목 줄(목록 위)에 그 일차의 원화 합계가 보인다
  const dayAmount = () => host.querySelector('section[aria-label="1일차 비용"]')!.firstElementChild!.textContent!.match(/([\d,]+)원/)?.[1];
  expect(dayAmount()).toBe("200");
  await chooseCategory("식비");
  expect(dayAmount()).toBe("200");
  expect(expenseRows(99)).toHaveLength(1);
  const selected = { ...whole, expenses: [whole.expenses[0]], days: [{ ...whole.days[0], total: { ...total, convertedTotalKrw: "100" } }] };
  mocks.state = { ...(mocks.state as object), krwFilters: { category: "FOOD" }, filteredKrwSummary: { isSuccess: true, data: selected } };
  await rerender();
  expect(dayAmount()).toBe("100");
  expect(expenseRows(99)).toHaveLength(0);
  mocks.state = { ...(mocks.state as object), filteredKrwSummary: { isSuccess: true, isFetching: true, data: selected } };
  await rerender();
  expect(dayAmount()).toBe("100");
});

it.each(["disconnected", "pending", "error", "ready"])("preserves known day totals during %s instead of switching to original currencies", async (syncStatus) => {
  await mount();
  const current = mocks.state as { krwSummary: { data: typeof contractFixture.response } };
  const total = { convertedTotalKrw: "12345", isComplete: false, missingCurrencies: ["AED"], originalTotals: [] };
  const summary = { ...current.krwSummary.data, days: [{ expenseGroup: "PREPARATION", scheduleId: null, total }] };
  mocks.state = { ...(mocks.state as object), syncStatus, krwSummary: { data: summary, isSuccess: syncStatus !== "error", isError: syncStatus === "error", isFetching: syncStatus === "pending" || syncStatus === "ready" } };
  await rerender();
  const heading = host.querySelector('section[aria-label="여행 준비 비용"]')!.firstElementChild!;
  expect(heading.textContent).toContain("12,345원");
  expect(heading.textContent).not.toContain("KRW");
});
