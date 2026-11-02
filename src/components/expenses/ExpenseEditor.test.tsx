// @vitest-environment jsdom
// Place-cache subscriptions are covered by ExpensePlaceLabel.test.tsx.
vi.mock("./ExpensePlaceLabel", () => ({ ExpensePlaceLabel: () => null }));
vi.mock("@/lib/api/config", () => ({ API_BASE: "http://fixture" }));
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ExpenseApiError, type Expense } from "@/lib/api/rooms/expenses";
import { ExpenseEditor, type ExpenseEntry } from "./ExpenseEditor";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  readLatest: vi.fn(),
  close: vi.fn(),
  state: null as unknown,
  mobile: false,
}));
vi.mock("./ExpenseProvider", () => ({ useExpenseContext: () => mocks.state }));
vi.mock("@/contexts/MobileViewContext", () => ({ useMobileView: () => ({ isMobileDevice: mocks.mobile }) }));
vi.mock("@/hooks/useRooms", () => ({
  useSchedulePlanPlaces: () => ({
    data: [{ itemId: 100, title: "경복궁" }],
    isSuccess: true,
    isError: false,
    isPending: false,
  }),
}));
const currencies = [
  { currency: "USD", fractionDigits: 2, maximumAmount: "999999999999999.99" },
  { currency: "KRW", fractionDigits: 0, maximumAmount: "999999999999999" },
];
const base: Expense = {
  expenseGroup: "TRIP_DAY",
  scheduleId: 10,
  scheduleItemId: 100,
  totalAmount: "10.01",
  currency: "USD",
  category: "OTHER",
  memo: "",
  payerUserIds: [1, 99],
  participantUserIds: [1],
  id: 10,
  version: 0,
  name: null,
  createdAt: "",
  updatedAt: "",
};
const categories = [
  ["FLIGHT", "항공"],
  ["ACCOMMODATION", "숙박"],
  ["FOOD", "식비"],
  ["TRANSPORT", "교통"],
  ["SHOPPING", "쇼핑"],
  ["SIGHTSEEING", "관광"],
  ["OTHER", "기타"],
] as const;

let host: HTMLDivElement;
let root: Root;
// 오류 문장을 보이는 곳까지 스크롤하는 동작을 본다. jsdom에는 scrollIntoView가 없다
const scrollIntoView = vi.fn();
beforeEach(() => {
  localStorage.clear();
  mocks.mobile = false;
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  Reflect.deleteProperty(window, "matchMedia");
});

function contextState(original: Expense | null) {
  return {
    currentUserId: 1,
    roomId: "r",
    members: [{ userId: 1, status: "ACTIVE", role: "HOST", nickname: "하나", profileImageUrl: null }],
    memberStatus: "success",
    canManage: true,
    schedules: [
      { scheduleId: 10, dayNumber: 1 },
      { scheduleId: 11, dayNumber: 2 },
    ],
    schedulesReady: true,
    currencies: { data: currencies, isSuccess: true, isError: false },
    save: mocks.save,
    readLatest: mocks.readLatest,
    list: { isSuccess: true, data: original ? [original] : [] },
    busy: false,
  };
}
function setState(patch: object) {
  mocks.state = { ...(mocks.state as object), ...patch };
}
async function render(node: ReactNode) {
  await act(async () => root.render(node));
}
async function mount(original: Expense | null = base, entry: ExpenseEntry = {}) {
  mocks.save.mockReset();
  mocks.readLatest.mockReset();
  mocks.close.mockReset();
  mocks.state = contextState(original);
  await render(null);
  await render(<ExpenseEditor initial={original ? { expense: original } : entry} onClose={mocks.close} />);
}
// 새 비용 편집기를 다시 연다(닫았다 다시 연 것과 같다). 저장된 통화 선호를 연 순간에 읽는다
async function reopenNewEditor() {
  await render(null);
  await render(<ExpenseEditor initial={{}} onClose={mocks.close} />);
}

// Base UI는 열고 닫을 때 microtask·timeout으로 포커스·목록을 옮긴다
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"][data-slot="dialog-content"]');
const form = () => dialog()!.querySelector("form")!;
const button = (name: string) =>
  [...dialog()!.querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.getAttribute("aria-label") === name || node.textContent === name,
  );
const saveButton = () => dialog()!.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const amountInput = () => dialog()!.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
const nameInput = () => dialog()!.querySelector<HTMLInputElement>('input[name="expense-title"]')!;
const memoInput = () => dialog()!.querySelector("textarea")!;
const selectTrigger = (label: string) =>
  dialog()!.querySelector<HTMLElement>(`[role="combobox"][aria-label="${label}"]`)!;
const currencyTrigger = () => dialog()!.querySelector<HTMLElement>('[role="combobox"][aria-haspopup="dialog"]')!;
// 통화 트리거는 코드 + 한국어 이름을 보이고, 값이 없으면 "통화 선택"을 보인다
const currencyValue = () => {
  const text = currencyTrigger().textContent ?? "";
  return text === "통화 선택" ? "" : text.slice(0, 3);
};
const fieldOf = (element: Element) => element.closest('[data-slot="field"]')!;
const fieldError = (element: Element) => fieldOf(element).querySelector('[data-slot="field-error"]')?.textContent ?? null;
// 폼 아래 문장(저장 실패·권한·충돌 등). 칸 오류(FieldError)는 각 칸 안에 있다
const formMessage = () => form().querySelector(":scope > p[role=\"alert\"]")?.textContent ?? null;

async function key(target: Element, key: string) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
  await flush();
}
async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function click(element: HTMLElement) {
  await act(async () => element.click());
  await flush();
}
async function openSelect(label: string) {
  await click(selectTrigger(label));
  const list = document.getElementById(selectTrigger(label).getAttribute("aria-controls")!)!;
  return [...list.querySelectorAll<HTMLElement>('[role="option"]')];
}
async function choose(label: string, optionText: string) {
  const option = (await openSelect(label)).find((node) => node.textContent === optionText);
  expect(option, `${label}: ${optionText}`).toBeDefined();
  await click(option!);
}
async function chooseCurrency(code: string) {
  await click(currencyTrigger());
  const popup = document.querySelector('[role="dialog"][aria-label="통화 선택"]')!;
  const option = [...popup.querySelectorAll<HTMLElement>('[role="option"]')].find((node) => node.textContent?.endsWith(code));
  await click(option!);
}
async function clickSave() {
  await click(saveButton());
  await flush();
}
// 저장 버튼이 비활성인 상태에서도 제출 경로(Enter 등)가 저장을 막는지 본다
async function submitForm() {
  await act(async () => form().requestSubmit());
  await flush();
}
async function completeNewExpense() {
  await type(amountInput(), currencyValue() === "USD" ? "100.00" : "100");
  await choose("카테고리", "기타");
  await clickSave();
}

const rolePicker = (title: "결제자" | "부담자") =>
  [...dialog()!.querySelectorAll<HTMLFieldSetElement>("fieldset[aria-labelledby]")].find(
    (fieldset) => document.getElementById(fieldset.getAttribute("aria-labelledby")!)?.firstElementChild?.textContent === title,
  )!;
const roleCheckboxes = (title: "결제자" | "부담자") => [...rolePicker(title).querySelectorAll<HTMLElement>('[role="checkbox"]')];
const roleRows = (title: "결제자" | "부담자") =>
  [...rolePicker(title).querySelectorAll("label")].map((row) => ({
    userId: Number(row.querySelector("[data-user-id]")!.getAttribute("data-user-id")),
    checked: row.querySelector('[role="checkbox"]')!.getAttribute("aria-checked") === "true",
    checkbox: row.querySelector<HTMLElement>('[role="checkbox"]')!,
  }));
const checkedIds = (title: "결제자" | "부담자") => roleRows(title).filter((row) => row.checked).map((row) => row.userId);

it("remembers currency only after a successful new expense save", async () => {
  await mount(null);
  expect(currencyValue()).toBe("KRW");
  await chooseCurrency("USD");
  expect(currencyValue()).toBe("USD");
  expect(localStorage).toHaveLength(0);
  await completeNewExpense();
  expect(mocks.save).toHaveBeenCalledOnce();
  expect(Object.values({ ...localStorage })).toEqual(["USD"]);
  await mount(null);
  expect(currencyValue()).toBe("USD");
});

it("does not remember cancelled, failed, or edited expense currency", async () => {
  await mount(null);
  await chooseCurrency("USD");
  await click(button("닫기")!);
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(localStorage).toHaveLength(0);
  await mount(null);
  await chooseCurrency("USD");
  mocks.save.mockRejectedValueOnce(new Error("저장 실패"));
  await completeNewExpense();
  expect(mocks.save).toHaveBeenCalledOnce();
  expect(localStorage).toHaveLength(0);
  await mount();
  await clickSave();
  expect(mocks.save).toHaveBeenCalledOnce();
  expect(localStorage).toHaveLength(0);
});

it("scopes the remembered currency to the authenticated user and room", async () => {
  await mount(null);
  await chooseCurrency("USD");
  await completeNewExpense();
  setState({ currentUserId: 2 });
  await reopenNewEditor();
  expect(currencyValue()).toBe("KRW");
  setState({ currentUserId: 1, roomId: "another-room" });
  await reopenNewEditor();
  expect(currencyValue()).toBe("KRW");
  setState({ roomId: "r" });
  await reopenNewEditor();
  expect(currencyValue()).toBe("USD");
});

it("uses the current list for stale preference and reads tab changes on the next open", async () => {
  await mount(null);
  await chooseCurrency("USD");
  await completeNewExpense();
  const storageKey = localStorage.key(0)!;
  localStorage.setItem(storageKey, "BAD");
  await reopenNewEditor();
  expect(currencyValue()).toBe("KRW");
  localStorage.setItem(storageKey, "USD");
  await reopenNewEditor();
  expect(currencyValue()).toBe("USD");
  setState({ currencies: { data: [currencies[0]], isSuccess: true } });
  await reopenNewEditor();
  expect(currencyValue()).toBe("USD");
  localStorage.setItem(storageKey, "KRW");
  await reopenNewEditor();
  expect(currencyValue()).toBe("USD");
});

it("applies preference after currencies load without replacing a later manual choice", async () => {
  await mount(null);
  await chooseCurrency("USD");
  await completeNewExpense();
  setState({ currencies: { data: undefined, isSuccess: false } });
  await reopenNewEditor();
  expect(currencyValue()).toBe("");
  setState({ currencies: { data: currencies, isSuccess: true } });
  await render(<ExpenseEditor initial={{}} onClose={mocks.close} />);
  expect(currencyValue()).toBe("USD");
  await chooseCurrency("KRW");
  localStorage.setItem(localStorage.key(0)!, "USD");
  setState({ currencies: { data: [...currencies], isSuccess: true } });
  await render(<ExpenseEditor initial={{}} onClose={mocks.close} />);
  expect(currencyValue()).toBe("KRW");
});

it("keeps the normal default when storage is unavailable or identity is missing", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  await mount(null);
  expect(currencyValue()).toBe("KRW");
  setState({ currentUserId: undefined });
  await reopenNewEditor();
  expect(currencyValue()).toBe("KRW");
});

it("preselects self in both roles for new expenses and keeps self first", async () => {
  await mount(null);
  const state = mocks.state as { members: object[] };
  setState({
    currentUserId: 2,
    members: [...state.members, { userId: 2, status: "ACTIVE", role: "MEMBER", nickname: "나", profileImageUrl: null }],
  });
  await render(<ExpenseEditor key="self" initial={{}} onClose={mocks.close} />);
  for (const title of ["결제자", "부담자"] as const) {
    expect(checkedIds(title)).toEqual([2]);
    expect(roleRows(title).map((row) => row.userId)).toEqual([2, 1]);
    await click(roleRows(title)[0].checkbox);
  }
  await render(<ExpenseEditor key="self" initial={{}} onClose={mocks.close} />);
  for (const title of ["결제자", "부담자"] as const) expect(checkedIds(title)).toEqual([]);
});

it("formats typed amounts without changing exact submitted decimals", async () => {
  await mount();
  await type(amountInput(), "999,999,999,999,999.99");
  expect(amountInput().value).toBe("999,999,999,999,999.99");
  await clickSave();
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ totalAmount: "999999999999999.99" }), 10, 0);
});

it("preserves original unknown payer and exact amount when editing", async () => {
  await mount();
  await clickSave();
  expect(mocks.save).toHaveBeenCalledWith(
    expect.objectContaining({ payerUserIds: [1, 99], participantUserIds: [1], totalAmount: "10.01", scheduleItemId: 100 }),
    10,
    0,
  );
  expect(mocks.close).toHaveBeenCalledOnce();
});

it("clears both links for preparation and clears place when changing day", async () => {
  await mount();
  await choose("일차 구분", "2일차");
  expect(selectTrigger("연결 장소 (선택)").textContent).toBe("장소 연결 없음");
  await clickSave();
  expect(mocks.save).toHaveBeenLastCalledWith(
    expect.objectContaining({ expenseGroup: "TRIP_DAY", scheduleId: 11, scheduleItemId: null }),
    10,
    0,
  );
  await mount();
  await choose("일차 구분", "여행 준비");
  await clickSave();
  expect(mocks.save).toHaveBeenLastCalledWith(
    expect.objectContaining({ expenseGroup: "PREPARATION", scheduleId: null, scheduleItemId: null }),
    10,
    0,
  );
});

it("keeps the place selector visible but disabled for travel preparation", async () => {
  await mount(null);
  const place = () => selectTrigger("연결 장소 (선택)");
  expect(selectTrigger("일차 구분").textContent).toBe("여행 준비");
  expect(place().textContent).toBe("장소 연결 없음");
  expect(place().hasAttribute("data-disabled")).toBe(true);

  await choose("일차 구분", "1일차");
  expect(place().hasAttribute("data-disabled")).toBe(false);
  const options = await openSelect("연결 장소 (선택)");
  expect(options.map((option) => option.textContent)).toEqual(["장소 연결 없음", "경복궁"]);
  await key(document.activeElement!, "Escape");

  await choose("일차 구분", "여행 준비");
  expect(place().hasAttribute("data-disabled")).toBe(true);
  expect(place().textContent).toBe("장소 연결 없음");
});

it("blocks wrong currency scale without truncating and guards rapid duplicate submit", async () => {
  await mount();
  await type(amountInput(), "10.001");
  await clickSave();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(amountInput().value).toBe("10.001");
  expect(amountInput().getAttribute("aria-invalid")).toBe("true");
  expect(fieldError(amountInput())).toBe("금액은 정수부 1~15자리, 소수 2자리로 입력해 주세요. 공백·기호·지수는 사용할 수 없어요.");
  await type(amountInput(), "10.01");
  expect(amountInput().hasAttribute("aria-invalid")).toBe(false);
  expect(fieldError(amountInput())).toBeNull();
  let finish!: () => void;
  mocks.save.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  await act(async () => {
    saveButton().click();
    saveButton().click();
  });
  await flush();
  expect(mocks.save).toHaveBeenCalledOnce();
  await act(async () => finish());
});

it("does not submit when members fail and shows failure without removing historical data", async () => {
  await mount();
  setState({ memberStatus: "error", canManage: false });
  await render(<ExpenseEditor initial={{ expense: base }} onClose={mocks.close} />);
  expect(saveButton().disabled).toBe(true);
  await submitForm();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(dialog()!.textContent).toContain("멤버 정보 조회 실패");
  expect(dialog()!.textContent).not.toContain("(알 수 없음)");
});

it.each([
  [{}, "PREPARATION", null, null],
  [{ scheduleId: 10 }, "TRIP_DAY", 10, null],
  [{ scheduleId: 10, scheduleItemId: 100 }, "TRIP_DAY", 10, 100],
] as const)("creates an expense from each real entry context %j", async (entry, expenseGroup, scheduleId, scheduleItemId) => {
  await mount(null, entry);
  await type(amountInput(), "100");
  for (const title of ["결제자", "부담자"] as const)
    for (const row of roleRows(title).filter((row) => !row.checked)) await click(row.checkbox);
  await choose("카테고리", "기타");
  await clickSave();
  expect(mocks.save).toHaveBeenCalledWith(
    {
      expenseGroup,
      scheduleId,
      scheduleItemId,
      totalAmount: "100",
      currency: "KRW",
      category: "OTHER",
      name: null,
      memo: "",
      payerUserIds: [1],
      participantUserIds: [1],
    },
    undefined,
    undefined,
  );
});

it("cannot re-add an unknown payer after deselection and keeps input on server rejection", async () => {
  await mount();
  expect(roleCheckboxes("결제자")).toHaveLength(2);
  expect(roleCheckboxes("부담자")).toHaveLength(1);
  const unknown = roleRows("결제자").find((row) => row.userId === 99)!;
  await click(unknown.checkbox);
  expect(roleRows("결제자").map((row) => row.userId)).toEqual([1]);
  mocks.save.mockRejectedValue(new Error("서버 검증 실패"));
  await clickSave();
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ payerUserIds: [1], totalAmount: "10.01" }), 10, 0);
  expect(mocks.close).not.toHaveBeenCalled();
  expect(formMessage()).toBe("서버 검증 실패");
});

async function fillNewExpense() {
  await type(amountInput(), "100");
  for (const title of ["결제자", "부담자"] as const)
    for (const row of roleRows(title).filter((row) => !row.checked)) await click(row.checkbox);
}

it("requires explicit selection and offers exactly seven labeled categories in approved order", async () => {
  await mount(null);
  await fillNewExpense();
  await clickSave();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(selectTrigger("카테고리").textContent).toBe("카테고리 선택");
  const options = await openSelect("카테고리");
  expect(options.map((option) => option.textContent)).toEqual(categories.map(([, label]) => label));
});

it("shows the missing category under its field and clears it once a category is chosen", async () => {
  await mount(null);
  await fillNewExpense();
  await clickSave();
  expect(mocks.save).not.toHaveBeenCalled();
  const category = selectTrigger("카테고리");
  expect(category.getAttribute("aria-invalid")).toBe("true");
  expect(fieldError(category)).toBe("카테고리를 선택해 주세요.");
  // 칸 오류는 폼 아래 문장으로 겹쳐 보이지 않는다
  expect(formMessage()).toBeNull();
  expect(form().hasAttribute("aria-describedby")).toBe(false);
  // 다른 칸은 오류가 없다
  expect(fieldError(amountInput())).toBeNull();
  await choose("카테고리", "식비");
  expect(selectTrigger("카테고리").hasAttribute("aria-invalid")).toBe(false);
  expect(fieldError(selectTrigger("카테고리"))).toBeNull();
  await clickSave();
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ category: "FOOD" }), undefined, undefined);
});

it.each(categories)("creates the selected category %s (%s)", async (category, label) => {
  await mount(null);
  await fillNewExpense();
  await choose("카테고리", label);
  await clickSave();
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ category, totalAmount: "100" }), undefined, undefined);
});

it.each(categories)("retains %s (%s) on edit and permits explicit reclassification", async (category, label) => {
  await mount({ ...base, category });
  expect(selectTrigger("카테고리").textContent).toBe(label);
  await clickSave();
  expect(mocks.save).toHaveBeenLastCalledWith(expect.objectContaining({ category }), 10, 0);
  const [replacement, replacementLabel] = category === "OTHER" ? categories[0] : categories[6];
  await choose("카테고리", replacementLabel);
  mocks.save.mockRejectedValueOnce(new Error("카테고리 저장 실패"));
  await clickSave();
  expect(mocks.save).toHaveBeenLastCalledWith(expect.objectContaining({ category: replacement }), 10, 0);
  expect(selectTrigger("카테고리").textContent).toBe(replacementLabel);
  expect(formMessage()).toBe("카테고리 저장 실패");
});

it("closes only the open list on Escape, not the editor", async () => {
  await mount();
  await openSelect("카테고리");
  expect(selectTrigger("카테고리").getAttribute("aria-expanded")).toBe("true");
  await key(document.activeElement!, "Escape");
  expect(selectTrigger("카테고리").getAttribute("aria-expanded")).toBe("false");
  await click(currencyTrigger());
  expect(currencyTrigger().getAttribute("aria-expanded")).toBe("true");
  await key(document.activeElement!, "Escape");
  expect(currencyTrigger().getAttribute("aria-expanded")).toBe("false");
  expect(mocks.close).not.toHaveBeenCalled();
  expect(dialog()).not.toBeNull();
});

it.each([false, true])("closes from the backdrop only on mobile devices (mobile: %s)", async (mobile) => {
  mocks.mobile = mobile;
  await mount();
  const backdrop = document.querySelector<HTMLElement>(
    mobile ? '[data-slot="drawer-overlay"]' : '[data-slot="dialog-overlay"]',
  )!;
  await act(async () => {
    backdrop.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    backdrop.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    backdrop.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    backdrop.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flush();
  expect(mocks.close).toHaveBeenCalledTimes(mobile ? 1 : 0);
});

// 편집기를 연 버튼에 포커스를 두고 열고, 닫히면(onClose) 부모처럼 편집기를 내린다
async function mountWithOpener() {
  const opener = document.createElement("button");
  opener.textContent = "비용 추가";
  document.body.append(opener);
  opener.focus();
  await mount();
  mocks.close.mockImplementation(() => root.render(null));
  // Base UI는 다음 프레임에 대화상자 안 첫 포커스 요소로 포커스를 옮긴다
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
  expect(dialog()!.contains(document.activeElement)).toBe(true);
  return opener;
}
async function settle() {
  await flush();
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
}

it.each(["Escape", "닫기", "취소", "save"])("returns focus to the opener after %s closes the editor", async (path) => {
  const opener = await mountWithOpener();
  if (path === "Escape") await key(document.activeElement!, "Escape");
  else if (path === "save") await clickSave();
  else await click(button(path)!);
  await settle();
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(dialog()).toBeNull();
  expect(document.activeElement).toBe(opener);
});

it("does not focus an opener removed while the editor was open", async () => {
  const opener = await mountWithOpener();
  const focus = vi.spyOn(opener, "focus");
  opener.remove();
  await key(document.activeElement!, "Escape");
  await settle();
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(focus).not.toHaveBeenCalled();
  expect(document.activeElement).not.toBe(opener);
});

it("locks every dismissal during save and shows progress, then returns focus on success", async () => {
  const opener = await mountWithOpener();
  let finish!: () => void;
  mocks.save.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  await clickSave();
  expect(saveButton().getAttribute("aria-busy")).toBe("true");
  expect(saveButton().getAttribute("aria-disabled")).toBe("true");
  expect(document.getElementById(saveButton().getAttribute("aria-labelledby")!)!.textContent).toBe("저장 중");
  expect(button("닫기")!.disabled).toBe(true);
  expect(button("취소")!.disabled).toBe(true);
  await click(button("닫기")!);
  await click(button("취소")!);
  await key(document.activeElement!, "Escape");
  await click(saveButton());
  expect(mocks.close).not.toHaveBeenCalled();
  expect(mocks.save).toHaveBeenCalledOnce();
  expect(dialog()!.contains(document.activeElement)).toBe(true);
  await act(async () => finish());
  await settle();
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(opener);
});

it("keeps the editor open on save rejection and returns focus on later dismissal", async () => {
  const opener = await mountWithOpener();
  mocks.save.mockRejectedValueOnce(new Error("저장 실패"));
  await clickSave();
  expect(mocks.close).not.toHaveBeenCalled();
  expect(formMessage()).toBe("저장 실패");
  expect(saveButton().hasAttribute("aria-busy")).toBe(false);
  expect(dialog()!.contains(document.activeElement)).toBe(true);
  await key(document.activeElement!, "Escape");
  await settle();
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(opener);
});

const recoveryButton = (label: string) => button(label);
it("keeps the opened version when background list and entry refresh", async () => {
  await mount();
  setState({ list: { isSuccess: true, data: [{ ...base, version: 9 }] } });
  await render(<ExpenseEditor initial={{ expense: { ...base, version: 9 } }} onClose={mocks.close} />);
  await clickSave();
  expect(mocks.save).toHaveBeenLastCalledWith(expect.anything(), 10, 0);
});

it("retains the draft and requires explicit latest-record review before saving again", async () => {
  await mount();
  await type(memoInput(), "my draft");
  mocks.save.mockRejectedValueOnce(new ExpenseApiError(409, "EXPENSE_CONFLICT", "changed"));
  mocks.readLatest.mockResolvedValueOnce({ ...base, version: 2, memo: "remote memo" });
  await clickSave();
  expect(mocks.readLatest).toHaveBeenCalledWith(10);
  expect(mocks.close).not.toHaveBeenCalled();
  expect(memoInput().value).toBe("my draft");
  expect(dialog()!.textContent).toContain("remote memo");
  expect(saveButton().disabled).toBe(true);
  await submitForm();
  expect(mocks.save).toHaveBeenCalledTimes(1);
  await click(recoveryButton("최신 비용 확인 후 수정 계속")!);
  expect(mocks.save).toHaveBeenCalledTimes(1);
  await clickSave();
  expect(mocks.save).toHaveBeenLastCalledWith(
    expect.objectContaining({ memo: "my draft", payerUserIds: [1, 99], totalAmount: "10.01" }),
    10,
    2,
  );
});

it.each([undefined, { ...base, version: 2, scheduleId: 11 }])("blocks retry for a deleted or moved conflict target", async (latest) => {
  await mount();
  mocks.save.mockRejectedValueOnce(new ExpenseApiError(409, "EXPENSE_CONFLICT", "changed"));
  mocks.readLatest.mockResolvedValueOnce(latest);
  await clickSave();
  await submitForm();
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(recoveryButton("최신 비용 확인 후 수정 계속")).toBeUndefined();
  expect(dialog()!.textContent).toContain(latest ? "연결 위치가 변경되었어요" : "비용이 삭제되었어요");
  expect(mocks.close).not.toHaveBeenCalled();
});

it("blocks save after failed conflict read until a fresh read and explicit review", async () => {
  await mount();
  mocks.save.mockRejectedValueOnce(new ExpenseApiError(409, "EXPENSE_CONFLICT", "changed"));
  mocks.readLatest.mockRejectedValueOnce(new Error("offline"));
  await clickSave();
  expect(dialog()!.textContent).toContain("최신 비용 조회에 실패했어요");
  await submitForm();
  expect(mocks.save).toHaveBeenCalledTimes(1);
  mocks.readLatest.mockResolvedValueOnce({ ...base, version: 3 });
  await click(recoveryButton("최신 비용 다시 조회")!);
  expect(mocks.save).toHaveBeenCalledTimes(1);
  await click(recoveryButton("최신 비용 확인 후 수정 계속")!);
  await clickSave();
  expect(mocks.save).toHaveBeenLastCalledWith(expect.anything(), 10, 3);
});

it.each([{ data: [] }, { data: [{ ...base, version: 1, scheduleId: 11 }] }])(
  "blocks saving a target already known deleted or moved",
  async ({ data }) => {
    await mount();
    setState({ list: { isSuccess: true, data } });
    await render(<ExpenseEditor initial={{ expense: base }} onClose={mocks.close} />);
    expect(saveButton().disabled).toBe(true);
    expect(formMessage()).toContain("비용이 삭제되었거나 다른 위치로 이동했어요");
    await submitForm();
    expect(mocks.save).not.toHaveBeenCalled();
  },
);

it("reveals every save failure, including a repeated error message", async () => {
  await mount();
  mocks.save.mockRejectedValue(new Error("저장 실패"));
  await clickSave();
  expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
  expect((scrollIntoView.mock.contexts[0] as Element).textContent).toBe("저장 실패");
  await clickSave();
  expect(scrollIntoView).toHaveBeenCalledTimes(2);
  expect(formMessage()).toBe("저장 실패");
});

it("reveals repeated field errors without smooth scrolling when reduced motion is requested", async () => {
  window.matchMedia = vi.fn(() => ({ matches: true })) as unknown as typeof window.matchMedia;
  await mount(null);
  for (let attempt = 0; attempt < 2; attempt++) await clickSave();
  expect(scrollIntoView).toHaveBeenCalledTimes(2);
  expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest", behavior: "instant" });
  // 첫 칸 오류(금액)를 보여 준다
  expect((scrollIntoView.mock.contexts[1] as Element).getAttribute("data-slot")).toBe("field-error");
  expect(fieldOf(scrollIntoView.mock.contexts[1] as Element)).toBe(fieldOf(amountInput()));
  expect(mocks.save).not.toHaveBeenCalled();
});

it("edits an optional independent name, uses the design name prompt, and explicitly clears it", async () => {
  await mount(null);
  expect(nameInput().placeholder).toBe("제목 없음");
  expect(nameInput().maxLength).toBe(100);
  await type(nameInput(), "점심");
  await completeNewExpense();
  expect(mocks.save.mock.lastCall?.[0]).toMatchObject({ name: "점심", memo: "" });
  await mount(null);
  await type(nameInput(), " 　");
  await completeNewExpense();
  expect(mocks.save.mock.lastCall?.[0].name).toBeNull();
});

it("omits an unchanged name on PATCH, clears explicitly, and rejects raw overlength before saving", async () => {
  await mount({ ...base, name: "기존 이름" });
  await clickSave();
  expect(mocks.save.mock.lastCall?.[0]).not.toHaveProperty("name");
  await type(nameInput(), "");
  await clickSave();
  expect(mocks.save.mock.lastCall?.[0]).toMatchObject({ name: null, memo: base.memo });
  mocks.save.mockClear();
  await type(nameInput(), "😀".repeat(50) + " ");
  await clickSave();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(nameInput().getAttribute("aria-invalid")).toBe("true");
  expect(fieldError(nameInput())).toBe("제목은 공백을 포함해 100자 이내로 입력해 주세요.");
});
