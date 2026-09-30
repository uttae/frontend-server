import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ExpenseList } from "./ExpenseViews";
import { ExpenseScopePanel } from "./ExpenseScopePanel";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
import type { Expense } from "@/lib/api/rooms/expenses";

const expense: Expense = {
  id: 1, expenseGroup: "TRIP_DAY", scheduleId: 2, scheduleItemId: 26,
  category: "FOOD", memo: "별도 메모", currency: "KRW", totalAmount: "1000",
  payerUserIds: [], participantUserIds: [], version: 0, name: null, createdAt: "", updatedAt: "",
};
let renderer: ReactTestRenderer;
let client: QueryClient;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  client = new QueryClient();
  client.setQueryData(scheduleItemsQueryKey("room", 2), [{ itemId: 26, title: "경복궁" }]);
});
afterEach(async () => { await act(async () => renderer?.unmount()); client.clear(); vi.unstubAllGlobals(); });

it.each([26, null])("uses category only in ledger titles regardless of linked place %s and memo", async scheduleItemId => {
  await act(async () => { renderer = create(<QueryClientProvider client={client}><ExpenseList roomId="room" expenses={[{ ...expense, scheduleItemId }]} members={[]} memberStatus="success" schedules={[]} canManage={false} busy={false} onEdit={vi.fn()} onDelete={vi.fn()} /></QueryClientProvider>); });
  const card = renderer.root.findByProps({ "data-expense-id": 1 });
  const title = card.findAllByType("p")[0];
  expect(title.children).toEqual(["식비"]);
  expect(JSON.stringify(renderer.toJSON())).toContain("별도 메모");
});
it("keeps scoped expense titles and edit labels category-only, with memo and place separate", async () => {
  await act(async () => { renderer = create(<QueryClientProvider client={client}><ExpenseScopePanel scope={{ scheduleId: 2, label: "2일차" }} roomId="room" expenses={[expense]} isPending={false} isError={false} canManage busy={false} onAdd={vi.fn()} onEdit={vi.fn()} onRetry={vi.fn()} onClose={vi.fn()} /></QueryClientProvider>); });
  const edit = renderer.root.findAllByType("button").find(b => b.props["aria-label"]?.endsWith("비용 수정"))!;
  expect(edit.props["aria-label"]).toBe("식비 1,000 KRW 비용 수정");
  expect(edit.findAllByType("span")[1].children).toEqual(["식비"]);
  expect(JSON.stringify(renderer.toJSON())).toContain("별도 메모");
  expect(JSON.stringify(renderer.toJSON())).toContain("경복궁");
});

it("uses persisted names for ledger titles while keeping category and memo separate", async () => {
  await act(async () => { renderer = create(<ExpenseList expenses={[{ ...expense, name: "점심 식사" }]} members={[]} memberStatus="success" schedules={[]} canManage={false} busy={false} onEdit={vi.fn()} onDelete={vi.fn()} />); });
  expect(renderer.root.findByProps({ "data-expense-id": 1 }).findAllByType("p")[0].children).toEqual(["점심 식사"]);
  const text = JSON.stringify(renderer.toJSON());
  expect(text).toContain("별도 메모");
  expect(text).toContain("식비");
});
