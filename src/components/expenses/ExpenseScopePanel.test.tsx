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
const button = (label: string) => host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
const confirmation = () => host.querySelector<HTMLDialogElement>('dialog[role="alertdialog"]');
async function openDelete() {
  const trigger = host.querySelector<HTMLButtonElement>('[aria-label$="USD 비용 삭제"]')!;
  trigger.focus();
  await act(async () => trigger.click());
  return trigger;
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  close.mockReset(); remove.mockReset(); remove.mockResolvedValue(undefined);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it("opens a separate modal and restores the delete trigger after cancel", async () => {
  const trigger = await openDelete();
  expect(confirmation()?.open).toBe(true);
  expect(document.activeElement).toBe(button("비용 삭제 취소"));
  await act(async () => button("비용 삭제 취소").click());
  expect(confirmation()).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(remove).not.toHaveBeenCalled();
});

it("Escape cancels only the confirmation and preserves the expense list", async () => {
  const trigger = await openDelete();
  expect(confirmation()).not.toBeNull();
  await act(async () => confirmation()!.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true })));
  expect(close).not.toHaveBeenCalled();
  expect(confirmation()).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it("blocks dismissal during deletion and restores focus to the list heading after success", async () => {
  let finish!: () => void;
  remove.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await openDelete();
  expect(confirmation()).not.toBeNull();
  await act(async () => button("비용 삭제 확인").click());
  await act(async () => confirmation()!.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true })));
  expect(confirmation()?.open).toBe(true);
  expect(button("비용 삭제 취소").disabled).toBe(true);
  expect(close).not.toHaveBeenCalled();
  await act(async () => finish());
  expect(confirmation()).toBeNull();
  expect(document.activeElement).toBe(host.querySelector("h2"));
  expect(host.querySelectorAll("li")).toHaveLength(0);
});


it("allows closing the list after management permission is lost during confirmation", async () => {
  await openDelete();
  await act(async () => root.render(<Harness canManage={false} />));
  expect(confirmation()).toBeNull();
  await act(async () => host.querySelector("dialog")!.dispatchEvent(new Event("cancel", { cancelable: true })));
  expect(close).toHaveBeenCalledOnce();
  expect(remove).not.toHaveBeenCalled();
});
