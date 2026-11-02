// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Expense } from "@/lib/api/rooms/expenses";
import type { RoomMember } from "@/lib/api/rooms/types";
import type { MemberQueryStatus } from "@/lib/expenses/expense-policy";
import { ExpenseEditor } from "./ExpenseEditor";

const mocks = vi.hoisted(() => ({ save: vi.fn(), close: vi.fn(), state: {} }));
vi.mock("./ExpenseProvider", () => ({ useExpenseContext: () => mocks.state }));
vi.mock("@/contexts/MobileViewContext", () => ({ useMobileView: () => ({ isMobileDevice: false }) }));
vi.mock("@/hooks/useRooms", () => ({
  useSchedulePlanPlaces: () => ({ data: [], isSuccess: true }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const members: RoomMember[] = [
  [1, "A", "ACTIVE"],
  [2, "B", "PENDING"],
  [3, "C", "LEFT"],
  [4, "D", "PENDING"],
].map(([userId, nickname, status]) => ({
  userId: userId as number,
  nickname: nickname as string,
  status: status as RoomMember["status"],
  role: "MEMBER",
  profileImageUrl: null,
  joinedAt: "",
  isOnline: false,
}));
const base: Expense = {
  id: 10,
  expenseGroup: "PREPARATION",
  scheduleId: null,
  scheduleItemId: null,
  totalAmount: "100",
  currency: "KRW",
  category: "OTHER",
  memo: "source memo",
  payerUserIds: [1, 2],
  participantUserIds: [1],
  version: 0,
  name: null,
  createdAt: "",
  updatedAt: "",
};
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  mocks.save.mockReset();
  mocks.close.mockReset();
  mocks.state = {
    roomId: "r",
    members,
    memberStatus: "success",
    canManage: true,
    currencies: {
      data: [{ currency: "KRW", fractionDigits: 0, maximumAmount: "999999999999999" }],
      isSuccess: true,
    },
    schedules: [],
    schedulesReady: true,
    busy: false,
    save: mocks.save,
  };
  // 칸 오류를 보이는 곳까지 스크롤한다. jsdom에는 scrollIntoView가 없다
  Element.prototype.scrollIntoView = vi.fn();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.body.replaceChildren();
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});
async function mount(expense: Expense | undefined = base) {
  await act(async () => root.render(<ExpenseEditor initial={{ expense }} onClose={mocks.close} />));
}
// Base UI는 열고 닫을 때 microtask·timeout으로 포커스를 옮긴다
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
const form = () => dialog().querySelector("form")!;
type Role = "결제자" | "부담자";
function picker(title: Role) {
  return [...dialog().querySelectorAll<HTMLFieldSetElement>("fieldset[aria-labelledby]")].find(
    (fieldset) => document.getElementById(fieldset.getAttribute("aria-labelledby")!)?.firstElementChild?.textContent === title,
  )!;
}
const text = (title: Role) => picker(title).textContent ?? "";
// 체크박스 행(고를 수 있는 멤버·알 수 없는 멤버)의 선택된 사람
function checkedIds(title: Role) {
  return [...picker(title).querySelectorAll("label")]
    .filter((row) => row.querySelector('[role="checkbox"]')?.getAttribute("aria-checked") === "true")
    .map((row) => Number(row.querySelector("[data-user-id]")!.getAttribute("data-user-id")));
}
// 제목 줄의 '선택 N명'. 승인 대기 멤버는 체크박스 없이 선택에 남는다
const selectedCount = (title: Role) => Number(/선택 (\d+)명/.exec(text(title))![1]);
const checkboxes = (title: Role) => picker(title).querySelectorAll('[role="checkbox"]');
function checkboxOf(title: Role, label: string) {
  return [...picker(title).querySelectorAll("label")]
    .find((row) => row.textContent?.includes(label))!
    .querySelector<HTMLElement>('[role="checkbox"]')!;
}
function removeButton(title: Role) {
  const buttons = [...picker(title).querySelectorAll<HTMLButtonElement>("button")].filter((node) => node.textContent === "제외");
  expect(buttons).toHaveLength(1);
  return buttons[0];
}
// 결제자·부담자를 함께 검증한 오류는 두 칸 아래 하나로 보인다
function roleError() {
  return picker("결제자").parentElement!.parentElement!.querySelector(':scope > [data-slot="field-error"]')?.textContent ?? null;
}
const formMessage = () => form().querySelector(':scope > p[role="alert"]')?.textContent ?? null;
const saveButton = () => dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!;
async function click(element: HTMLElement) {
  await act(async () => element.click());
  await flush();
}
async function submit() {
  await click(saveButton());
}
async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it.each(["결제자", "부담자"] as const)(
  "shows existing PENDING in %s with an explicit removal action, then saves only A",
  async (title) => {
    const expense = title === "결제자" ? base : { ...base, payerUserIds: [1], participantUserIds: [1, 2] };
    const source = structuredClone(expense);
    await mount(expense);
    expect(checkedIds(title)).toEqual([1]);
    expect(selectedCount(title)).toBe(2);
    expect(text(title)).toContain("B");
    expect(text(title)).toContain("승인 대기");
    // A and LEFT C are checkboxes; pending B is removal-only and new pending D is absent.
    expect(checkboxes(title)).toHaveLength(2);
    expect(text(title)).not.toContain("D");
    expect(text(title === "결제자" ? "부담자" : "결제자")).not.toContain("승인 대기");
    await click(removeButton(title));
    expect(checkedIds(title)).toEqual([1]);
    expect(selectedCount(title)).toBe(1);
    expect(text(title)).not.toContain("승인 대기");
    expect(picker(title).querySelectorAll("button")).toHaveLength(0);
    await submit();
    expect(mocks.save).toHaveBeenCalledWith({
      expenseGroup: "PREPARATION", scheduleId: null, scheduleItemId: null,
      totalAmount: "100", currency: "KRW", category: "OTHER", memo: "source memo",
      payerUserIds: [1], participantUserIds: [1],
    }, 10, 0);
    expect(expense).toEqual(source);
  },
);

it.each(["memo", "amount", "unchanged"])("retains PENDING and rejects %s edits until explicit removal", async (edit) => {
  await mount();
  if (edit === "memo") await type(dialog().querySelector("textarea")!, "edited");
  else if (edit === "amount") await type(dialog().querySelector<HTMLInputElement>('input[inputmode="decimal"]')!, "200");
  await submit();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(selectedCount("결제자")).toBe(2);
  expect(roleError()).toContain("선택할 수 없는 멤버");
  expect(formMessage()).toBeNull();
  expect(text("결제자")).toContain("승인 대기");
});

it("removes the same PENDING person independently from each role", async () => {
  await mount({ ...base, participantUserIds: [1, 2] });
  await click(removeButton("결제자"));
  expect(selectedCount("결제자")).toBe(1);
  expect(selectedCount("부담자")).toBe(2);
  expect(text("부담자")).toContain("승인 대기");
  await submit();
  expect(mocks.save).not.toHaveBeenCalled();
  await click(removeButton("부담자"));
  await submit();
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ payerUserIds: [1], participantUserIds: [1] }), 10, 0);
});

it.each(["결제자", "부담자"] as const)("reports a clear error when the last %s is removed", async (title) => {
  await mount({ ...base, payerUserIds: title === "결제자" ? [2] : [1], participantUserIds: title === "부담자" ? [2] : [1] });
  await click(removeButton(title));
  expect(selectedCount(title)).toBe(0);
  await submit();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(roleError()).toContain("각각 한 명 이상");
});

it("cancels explicit removal without mutating source and restores it on reopen", async () => {
  const expense = structuredClone(base);
  await mount(expense);
  await click(removeButton("결제자"));
  await click([...dialog().querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent === "취소")!);
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(expense).toEqual(base);
  await act(async () => root.render(null));
  await mount(expense);
  expect(selectedCount("결제자")).toBe(2);
  expect(text("결제자")).toContain("승인 대기");
});

it("never offers PENDING in a new expense", async () => {
  await act(async () => root.render(<ExpenseEditor initial={{}} onClose={mocks.close} />));
  for (const title of ["결제자", "부담자"] as const) {
    expect(selectedCount(title)).toBe(0);
    expect(checkboxes(title)).toHaveLength(2);
    expect(text(title)).not.toContain("B");
    expect(text(title)).not.toContain("D");
    expect(picker(title).querySelectorAll("button")).toHaveLength(0);
  }
});

it("preserves unknown roles, disallows copying/readding unknowns, and still selects LEFT", async () => {
  await mount({ ...base, payerUserIds: [1, 99], participantUserIds: [1, 98] });
  expect(text("결제자")).toContain("(알 수 없음)");
  expect(text("결제자")).not.toContain("#98");
  expect(text("부담자")).not.toContain("#99");
  await submit();
  expect(mocks.save).toHaveBeenLastCalledWith(expect.objectContaining({ payerUserIds: [1, 99], participantUserIds: [1, 98] }), 10, 0);
  await click(checkboxOf("결제자", "#99"));
  expect(text("결제자")).not.toContain("#99");
  await click(checkboxOf("결제자", "나간 멤버"));
  await submit();
  expect(mocks.save).toHaveBeenLastCalledWith(expect.objectContaining({ payerUserIds: [1, 3], participantUserIds: [1, 98] }), 10, 0);
});

it.each(["pending", "error"] as MemberQueryStatus[])("does not infer membership or alter selections during member %s", async (memberStatus) => {
  await mount();
  mocks.state = { ...mocks.state, members: [], memberStatus };
  await act(async () => root.render(<ExpenseEditor initial={{ expense: base }} onClose={mocks.close} />));
  expect(dialog().querySelectorAll("fieldset[aria-labelledby]")).toHaveLength(0);
  for (const label of ["승인 대기", "(알 수 없음)", "나간 멤버", "제외"]) expect(dialog().textContent).not.toContain(label);
  expect(saveButton().disabled).toBe(true);
  // 저장 버튼이 비활성이어도 제출 경로(Enter 등)가 저장하지 않는다
  await act(async () => form().requestSubmit());
  await flush();
  expect(mocks.save).not.toHaveBeenCalled();
  mocks.state = { ...mocks.state, members, memberStatus: "success" };
  await act(async () => root.render(<ExpenseEditor initial={{ expense: base }} onClose={mocks.close} />));
  expect(checkedIds("결제자")).toEqual([1]);
  expect(selectedCount("결제자")).toBe(2);
  expect(checkedIds("부담자")).toEqual([1]);
  expect(selectedCount("부담자")).toBe(1);
  expect(text("결제자")).toContain("승인 대기");
});
