// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  ExpenseApiError,
  type ExpenseBudget,
  type ExpenseKrwSummary,
} from "@/lib/api/rooms/expenses";
import { ExpenseBudgetModal } from "./ExpenseBudgetModal";
import { ExpenseBudgetSummary } from "./ExpenseBudgetSummary";
const mocks = vi.hoisted(() => ({
  state: null as unknown,
  save: vi.fn(),
  latest: vi.fn(),
  close: vi.fn(),
}));
vi.mock("./ExpenseProvider", () => ({
  useExpenseContext: () => mocks.state,
}));
let root: Root;
let host: HTMLDivElement;
const budget: ExpenseBudget = {
  budgetKrw: "1000",
  currency: "KRW",
  version: 2,
};
const reference: ExpenseKrwSummary = {
  originalTotals: [{ currency: "USD", totalAmount: "1.00" }],
  convertedTotalKrw: "501",
  rateDate: "2026-09-11",
  rateSource: "ECB",
  stale: false,
  missingCurrencies: [],
  isComplete: true,
};
function state(b = budget, r = reference) {
  return {
    syncStatus: "ready",
    canManage: true,
    budgetBusy: false,
    budget: { data: b, isSuccess: true, isError: false, isPending: false },
    krwSummary: {
      data: r,
      isSuccess: true,
      isError: false,
      isPending: false,
    },
    saveBudget: mocks.save,
    readLatestBudget: mocks.latest,
  };
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  mocks.state = state();
  mocks.save.mockResolvedValue({ ...budget, version: 3 });
  mocks.latest.mockResolvedValue({
    ...budget,
    budgetKrw: "2000",
    version: 7,
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function modal(initial = budget) {
  await act(async () =>
    root.render(<ExpenseBudgetModal initial={initial} onClose={mocks.close} />),
  );
}
async function summary() {
  await act(async () => root.render(<ExpenseBudgetSummary />));
}
function button(label: string) {
  const found = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === label || b.getAttribute("aria-label") === label,
  );
  expect(found, label).toBeTruthy();
  return found!;
}
async function click(label: string) {
  await act(async () => button(label).click());
}
function input() {
  return document.querySelector<HTMLInputElement>("input")!;
}
async function type(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input(), value);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => {
    document
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
const text = () => document.body.textContent!;
it.each([null, "0", "123456789"])(
  "prefills %s without conflating unset with zero",
  async (amount) => {
    await modal({ ...budget, budgetKrw: amount });
    expect(document.querySelector("h2")?.textContent).toBe(
      amount === null ? "예산 설정" : "예산 수정",
    );
    expect(input().value).toBe(amount ?? "");
    expect(text()).toContain("여행 전체의 예산을 설정해 주세요.");
    expect(document.querySelector("select")).toBeNull();
    await click("취소");
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.save).not.toHaveBeenCalled();
  },
);
it("close and Escape cancel without saving", async () => {
  await modal();
  await type("888");
  await click("예산 수정 닫기");
  await act(async () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });
  expect(mocks.close).toHaveBeenCalledTimes(2);
  expect(mocks.save).not.toHaveBeenCalled();
});
it.each(["0", "0001", "999999999999999"])(
  "sends exact allowed ASCII draft %s and opened version",
  async (value) => {
    await modal();
    await type(value);
    await submit();
    expect(mocks.save).toHaveBeenCalledWith({
      budgetKrw: value,
      expectedVersion: 2,
    });
    expect(mocks.close).toHaveBeenCalledOnce();
  },
);
it.each([
  "",
  " ",
  " 1",
  "1 ",
  "1,000",
  "-1",
  "+1",
  "1.0",
  "1e3",
  "１２３",
  "١٢٣",
  "1000000000000000",
])("rejects invalid budget %j without losing draft", async (value) => {
  await modal();
  await type(value);
  await submit();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(input().value).toBe(value);
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
});
it("locks duplicate submit and close while pending, and preserves draft on failure", async () => {
  let reject!: (e: Error) => void;
  mocks.save.mockImplementationOnce(
    () =>
      new Promise((_, r) => {
        reject = r;
      }),
  );
  await modal();
  await type("456");
  await submit();
  await submit();
  await click("예산 수정 닫기");
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(mocks.close).not.toHaveBeenCalled();
  await act(async () => reject(new Error("offline")));
  expect(input().value).toBe("456");
  expect(text()).toContain("offline");
  expect(button("저장").disabled).toBe(false);
});
it("409 preserves draft; failed latest read blocks retry until explicit successful review", async () => {
  mocks.save.mockRejectedValueOnce(
    new ExpenseApiError(409, "BUDGET_CONFLICT", "changed"),
  );
  mocks.latest.mockRejectedValueOnce(new Error("offline"));
  await modal();
  await type("456");
  await submit();
  expect(input().value).toBe("456");
  expect(button("저장").disabled).toBe(true);
  await submit();
  expect(mocks.save).toHaveBeenCalledTimes(1);
  await click("최신 예산 다시 조회");
  expect(text()).toContain("2,000");
  expect(button("저장").disabled).toBe(true);
  expect(input().value).toBe("456");
  await click("최신 예산 확인 후 수정 계속");
  expect(mocks.save).toHaveBeenCalledTimes(1);
  // Background refresh cannot silently advance the explicitly reviewed version.
  mocks.state = state({ ...budget, budgetKrw: "3000", version: 8 });
  await modal({ ...budget, budgetKrw: "3000", version: 8 });
  expect(input().value).toBe("456");
  await submit();
  expect(mocks.save).toHaveBeenLastCalledWith({
    budgetKrw: "456",
    expectedVersion: 7,
  });
});
it("another conflict requires another review and does not auto overwrite", async () => {
  mocks.save.mockRejectedValue(
    new ExpenseApiError(409, "BUDGET_CONFLICT", "changed"),
  );
  await modal();
  await type("456");
  await submit();
  await click("최신 예산 확인 후 수정 계속");
  await submit();
  expect(mocks.save).toHaveBeenCalledTimes(2);
  expect(mocks.latest).toHaveBeenCalledTimes(2);
  expect(button("저장").disabled).toBe(true);
  expect(input().value).toBe("456");
  expect(mocks.close).not.toHaveBeenCalled();
});
it("member access loss prevents submit", async () => {
  mocks.state = { ...state(), canManage: false };
  await modal();
  await submit();
  expect(mocks.save).not.toHaveBeenCalled();
});
it("summary opens shared modal for unset or zero budget", async () => {
  mocks.state = state({ ...budget, budgetKrw: null });
  await summary();
  expect(text()).toContain("미설정");
  await click("예산 설정");
  expect(document.querySelector("dialog")).not.toBeNull();
  expect(input().value).toBe("");
});
it("shows server reference with actual ECB attribution link and provided date", async () => {
  await summary();
  expect(text()).toContain("501");
  expect(text()).toContain("2026-09-11");
  expect(text()).toContain("European Central Bank (ECB)");
  expect(text()).toContain("거래·정산용이 아닙니다.");
  expect(document.querySelector("a")?.href).toBe(
    "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html",
  );
  expect(text()).toContain("참고 잔여 예산");
  expect(text()).toContain("499");
});
it.each([
  ["0", "0", "참고 잔여 예산", "0"],
  ["1000", "1001", "참고 예산 초과", "1"],
  [
    "999999999999999",
    "9007199254740993",
    "참고 예산 초과",
    "8,007,199,254,740,994",
  ],
])(
  "compares budget %s and reference %s precisely",
  async (b, total, label, value) => {
    mocks.state = state(
      { ...budget, budgetKrw: b },
      { ...reference, convertedTotalKrw: total },
    );
    await summary();
    const comparison = document.querySelector('[aria-label="예산 비교"]');
    expect(comparison?.textContent).toContain(label);
    expect(comparison?.textContent).toContain(value);
  },
);
it.each([
  { stale: true },
  { isComplete: false, missingCurrencies: ["KWD"] },
  { convertedTotalKrw: null },
  {
    stale: true,
    rateDate: null,
    convertedTotalKrw: null,
    missingCurrencies: ["USD"],
    isComplete: false,
  },
  { isComplete: true, missingCurrencies: ["KWD"] },
])("withholds comparison for unsafe reference %j", async (patch) => {
  mocks.state = state(budget, { ...reference, ...patch });
  await summary();
  expect(document.querySelector('[aria-label="예산 비교"]')).toBeNull();
  if (patch.missingCurrencies?.length)
    expect(text()).toContain(patch.missingCurrencies[0]);
  if (patch.convertedTotalKrw === null)
    expect(text()).toContain("환산 금액 없음");
  if (patch.rateDate === null) {
    expect(text()).toContain("제공일 없음");
    expect(text()).not.toContain("2026-09-11");
  }
});
it.each(["budget", "krwSummary"])(
  "withholds comparison after %s read fails even with cached data",
  async (key) => {
    const current = state();
    mocks.state = {
      ...current,
      [key]: {
        ...current[key as "budget" | "krwSummary"],
        isSuccess: false,
        isError: true,
      },
    };
    await summary();
    expect(document.querySelector('[aria-label="예산 비교"]')).toBeNull();
    expect(text()).toContain("조회에 실패");
  },
);
it("partial zero is labeled partial and unset never becomes a zero budget", async () => {
  mocks.state = state(
    { ...budget, budgetKrw: null },
    {
      ...reference,
      convertedTotalKrw: "0",
      isComplete: false,
      missingCurrencies: ["KWD"],
    },
  );
  await summary();
  expect(text()).toContain("부분 합계");
  expect(text()).toContain("KWD");
  expect(text()).toContain("미설정");
  expect(document.querySelector('[aria-label="예산 비교"]')).toBeNull();
});
it.each(["disconnected", "pending", "error"])(
  "suppresses definite remainder while %s even with cached successful data",
  async (syncStatus) => {
    mocks.state = { ...state(), syncStatus };
    await summary();
    expect(document.querySelector('[aria-label="예산 비교"]')).toBeNull();
  },
);
