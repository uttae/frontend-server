// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Expense } from "@/lib/api/rooms/expenses";
import { ExpenseScopePanel } from "./ExpenseScopePanel";

const expense: Expense = {
  id: 10, version: 2, expenseGroup: "TRIP_DAY", scheduleId: 2, scheduleItemId: null,
  currency: "USD", totalAmount: "50", category: "OTHER", memo: null, name: "교통",
  payerUserIds: [1], participantUserIds: [1], createdAt: "", updatedAt: "",
};
let root: Root;
let host: HTMLDivElement;
const close = vi.fn();
const remove = vi.fn<() => Promise<void>>();
function Harness({ canManage = true }: { canManage?: boolean }) {
  const [expenses, setExpenses] = useState([expense]);
  return <ExpenseScopePanel scope={{ scheduleId: 2, label: "1일차" }} roomId="r" expenses={expenses}
    isPending={false} isError={false} canManage={canManage} busy={false} onAdd={() => {}} onEdit={() => {}}
    onDelete={async () => { await remove(); setExpenses([]); }} onRetry={() => {}} onClose={close} />;
}
// 목록 대화상자·확인창은 Base UI가 document.body로 포털한다
const button = (label: string) => document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
const listDialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const confirmation = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
const listHeading = () => [...document.querySelectorAll("h3")].find((heading) => heading.textContent === "내역");
async function settle() {
  // 닫힘 전환·finalFocus(microtask)·Base UI의 requestAnimationFrame을 기다린다
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
}
async function pressEscape() {
  await act(async () => {
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
  });
  await settle();
}
async function openDelete() {
  const trigger = document.querySelector<HTMLButtonElement>('[aria-label$="USD 비용 삭제"]')!;
  trigger.focus();
  await act(async () => trigger.click());
  await settle();
  return trigger;
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  close.mockReset(); remove.mockReset(); remove.mockResolvedValue(undefined);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<Harness />));
  await settle();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it("opens a separate modal and restores the delete trigger after cancel", async () => {
  const trigger = await openDelete();
  expect(confirmation()).not.toBeNull();
  expect(confirmation()!.textContent).toContain("비용을 삭제할까요?");
  expect(listDialog()).not.toBeNull();
  expect(document.activeElement).toBe(button("비용 삭제 취소"));
  await act(async () => button("비용 삭제 취소").click());
  await settle();
  expect(confirmation()).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(remove).not.toHaveBeenCalled();
});

it("Escape cancels only the confirmation and preserves the expense list", async () => {
  const trigger = await openDelete();
  expect(confirmation()).not.toBeNull();
  await pressEscape();
  expect(close).not.toHaveBeenCalled();
  expect(confirmation()).toBeNull();
  expect(listDialog()).not.toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it("blocks dismissal during deletion and restores focus to the list heading after success", async () => {
  let finish!: () => void;
  remove.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await openDelete();
  expect(confirmation()).not.toBeNull();
  await act(async () => button("비용 삭제 확인").click());
  const confirm = confirmation()!.querySelector<HTMLButtonElement>("[aria-busy='true']")!;
  expect(confirm.getAttribute("aria-disabled")).toBe("true");
  expect(document.getElementById(confirm.getAttribute("aria-labelledby")!)!.textContent).toBe("삭제 중");
  await pressEscape();
  expect(confirmation()).not.toBeNull();
  const cancel = button("비용 삭제 취소");
  expect(cancel.disabled).toBe(true);
  await act(async () => cancel.click());
  await settle();
  expect(confirmation()).not.toBeNull();
  expect(close).not.toHaveBeenCalled();
  expect(remove).toHaveBeenCalledOnce();
  await act(async () => finish());
  await settle();
  expect(confirmation()).toBeNull();
  expect(document.activeElement).toBe(listHeading());
  expect(listDialog()!.querySelectorAll("li")).toHaveLength(0);
});


it("allows closing the list after management permission is lost during confirmation", async () => {
  await openDelete();
  await act(async () => root.render(<Harness canManage={false} />));
  await settle();
  expect(confirmation()).toBeNull();
  await pressEscape();
  expect(close).toHaveBeenCalledOnce();
  expect(remove).not.toHaveBeenCalled();
});
