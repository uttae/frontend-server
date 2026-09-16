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
    expect(input().value).toBe(amount === "123456789" ? "123,456,789" : amount ?? "");
    expect(text()).toContain("여행 전체의 예산을 설정해 주세요.");
    expect(text()).not.toContain("원화 정수로 입력해 주세요.");
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
  expect(input().value).toBe(value === "1000000000000000" ? "1,000,000,000,000,000" : value);
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
it("shows one reference travel total without persistent exchange metadata", async () => {
  await summary();
  expect(text()).toContain("여행 전체 지출");
  expect(text()).toContain("501 KRW");
  expect(text()).not.toContain("원화 참고 지출");
  expect(host.innerHTML).not.toContain("원화로 환산한 참고 금액이에요");
  expect(text()).not.toContain("2026-09-11");
  expect(text()).not.toContain("출처");
  expect(document.querySelector("a")).toBeNull();
  expect(document.querySelector('[aria-label="예산 비교"]')).toBeNull();
  expect(text()).not.toContain("참고 잔여 예산");
});
it.each([
  ["0", "0", "0 KRW"],
  ["1000", "1001", "1,001 KRW"],
  ["999999999999999", "9007199254740993", "9,007,199,254,740,993 KRW"],
])("omits budget comparison for budget %s and total %s", async (b, total, expected) => {
  mocks.state = state(
    { ...budget, budgetKrw: b },
    { ...reference, convertedTotalKrw: total },
  );
  await summary();
  expect(document.querySelector('[aria-label="예산 비교"]')).toBeNull();
  expect(text()).not.toMatch(/참고 잔여 예산|참고 예산 초과|예산과 최신/);
  expect(host.querySelector("h3")?.parentElement?.textContent).toContain(expected);
});
it.each([
  { isComplete: false, convertedTotalKrw: "501" },
  { isComplete: false, convertedTotalKrw: "0" },
  { convertedTotalKrw: null },
  { convertedTotalKrw: undefined },
  { missingCurrencies: ["KWD"] },
])("withholds unavailable or partial expenditure total %j", async (patch) => {
  mocks.state = state(budget, { ...reference, ...patch } as ExpenseKrwSummary);
  await summary();
  expect(host.querySelector("h3")?.parentElement?.textContent).toContain("—");
  expect(host.querySelector("h3")?.parentElement?.textContent).not.toMatch(/501 KRW|0 KRW|환산 가능한 지출 합계|제외 통화/);
});
it.each(["pending", "error"])("shows a dash with no conversion data while %s", async (status) => {
  mocks.state = { ...state(), krwSummary: { data: undefined, isPending: status === "pending", isError: status === "error", isSuccess: false } };
  await summary();
  expect(host.querySelector("h3")?.parentElement?.textContent).toContain("—");
  expect(text()).not.toContain("예산과 최신");
});
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
  expect(text()).not.toContain("환산 가능한 지출 합계");
  if (patch.convertedTotalKrw === null)
    expect(text()).toContain("—");
  if (patch.stale && patch.rateDate !== null) {
    expect(text()).toContain("환율 갱신에 실패하여 이전 성공 환율을 사용한 참고값이에요.");
    expect(text()).toContain("501 KRW");
  }
  if (patch.rateDate === null) {
    expect(text()).toContain("성공한 환율 정보가 없어");
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
it("partial zero is withheld and unset never becomes a zero budget", async () => {
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
  expect(text()).toContain("—");
  expect(text()).not.toContain("0 KRW");
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

it("formats pasted budget and serializes only digits", async () => {
  await modal();
  await type("1,234,567");
  expect(input().value).toBe("1,234,567");
  await submit();
  expect(mocks.save).toHaveBeenCalledWith({ budgetKrw: "1234567", expectedVersion: 2 });
});
it("keeps caret after middle edits and skips formatting commas on deletion", async () => {
  await modal({ ...budget, budgetKrw: "12345" });
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), "129,345");
    input().setSelectionRange(3, 3);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(input().value).toBe("129,345");
  expect(input().selectionStart).toBe(3);
  input().setSelectionRange(4, 4);
  await act(async () => input().dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true })));
  expect(input().selectionStart).toBe(3);
  await type("12,345");
  expect(input().value).toBe("12,345");
  input().setSelectionRange(2, 2);
  await act(async () => input().dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true })));
  expect(input().selectionStart).toBe(3);
  await type("12,45");
  expect(input().value).toBe("1,245");
  await type("");
  expect(input().value).toBe("");
  await submit();
  expect(mocks.save).not.toHaveBeenCalled();
});

it("keeps the trip total one scale step smaller with long-number wrapping", async () => {
  mocks.state = state(budget, { ...reference, convertedTotalKrw: "9007199254740993" });
  await summary();
  const total = [...host.querySelectorAll("p")].find(
    (p) => p.textContent === "9,007,199,254,740,993 KRW",
  )!;
  expect(total.classList.contains("text-2xl")).toBe(true);
  expect(total.classList.contains("break-all")).toBe(true);
});

it("groups budget and edit control on a white card with wrapping space for large amounts", async () => {
  mocks.state = state({ ...budget, budgetKrw: "999999999999999" });
  await summary();
  const title = [...host.querySelectorAll("h3")].find(
    (h) => h.textContent === "여행 전체 예산",
  )!;
  const content = title.parentElement!;
  const card = content.parentElement!;
  for (const token of ["rounded-xl", "bg-white", "p-3", "flex-wrap"])
    expect(card.classList.contains(token), token).toBe(true);
  for (const token of ["min-w-0", "max-w-full"])
    expect(content.classList.contains(token), token).toBe(true);
  expect(content.querySelector("p")?.textContent).toBe("999,999,999,999,999 KRW");
  expect(content.querySelector("p")?.classList.contains("break-all")).toBe(true);
  expect(card.contains(button("예산 수정"))).toBe(true);
  expect(button("예산 수정").classList.contains("shrink-0")).toBe(true);
  await click("예산 수정");
  expect(input().value).toBe("999,999,999,999,999");
  await type("1,234,567");
  await submit();
  expect(mocks.save).toHaveBeenCalledWith({ budgetKrw: "1234567", expectedVersion: 2 });
});

it("announces both pending budget reads with native status outputs", async () => {
  const pending = state();
  pending.budget.isPending = true;
  pending.budget.isSuccess = false;
  pending.krwSummary.isPending = true;
  pending.krwSummary.isSuccess = false;
  mocks.state = pending;
  await summary();
  const outputs = [...host.querySelectorAll("output")];
  expect(outputs.map(output => output.textContent)).toEqual([
    "원화 참고 요약을 불러오는 중…", "예산을 불러오는 중…",
  ]);
  expect(outputs.every(output => output.style.display === "block")).toBe(true);
});
