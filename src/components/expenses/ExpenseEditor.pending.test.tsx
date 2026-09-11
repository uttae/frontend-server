import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Expense } from "@/lib/api/rooms/expenses";
import type { RoomMember } from "@/lib/api/rooms/types";
import type { MemberQueryStatus } from "@/lib/expenses/expense-policy";
import { ExpenseEditor } from "./ExpenseEditor";
import { ExpenseRolePicker } from "./ExpenseViews";

const mocks = vi.hoisted(() => ({ save: vi.fn(), close: vi.fn(), state: {} }));
vi.mock("./ExpenseProvider", () => ({ useExpenseContext: () => mocks.state }));
vi.mock("@/hooks/useRooms", () => ({
  useSchedulePlanPlaces: () => ({ data: [], isSuccess: true }),
}));

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
  createdAt: "",
  updatedAt: "",
};
let renderer: ReactTestRenderer;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
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
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.unstubAllGlobals();
});
async function mount(expense: Expense | undefined = base) {
  await act(async () => {
    renderer = create(<ExpenseEditor initial={{ expense }} onClose={mocks.close} />);
  });
}
function picker(title: "결제자" | "부담자") {
  return renderer.root.findAllByType(ExpenseRolePicker).find((p) => p.props.title === title)!;
}
function text(node: ReactTestInstance | string): string {
  return typeof node === "string" ? node : node.children.map(text).join("");
}
function removeButton(title: "결제자" | "부담자") {
  const buttons = picker(title).findAllByType("button").filter((b) => text(b) === "제외");
  expect(buttons).toHaveLength(1);
  return buttons[0];
}
async function submit() {
  await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
}

it.each(["결제자", "부담자"] as const)(
  "shows existing PENDING in %s with an explicit removal action, then saves only A",
  async (title) => {
    const expense = title === "결제자" ? base : { ...base, payerUserIds: [1], participantUserIds: [1, 2] };
    const source = structuredClone(expense);
    await mount(expense);
    expect(picker(title).props.selected).toEqual([1, 2]);
    expect(text(picker(title))).toContain("B");
    expect(text(picker(title))).toContain("승인 대기");
    // A and LEFT C are checkboxes; pending B is removal-only and new pending D is absent.
    expect(picker(title).findAllByType("input")).toHaveLength(2);
    expect(text(picker(title))).not.toContain("D");
    expect(text(picker(title === "결제자" ? "부담자" : "결제자"))).not.toContain("승인 대기");
    await act(async () => removeButton(title).props.onClick());
    expect(picker(title).props.selected).toEqual([1]);
    expect(text(picker(title))).not.toContain("승인 대기");
    expect(picker(title).findAllByType("button")).toHaveLength(0);
    await submit();
    expect(mocks.save).toHaveBeenCalledWith({
      expenseGroup: "PREPARATION", scheduleId: null, scheduleItemId: null,
      totalAmount: "100", currency: "KRW", category: "OTHER", memo: "source memo",
      payerUserIds: [1], participantUserIds: [1],
    }, 10);
    expect(expense).toEqual(source);
  },
);

it.each(["memo", "amount", "unchanged"])("retains PENDING and rejects %s edits until explicit removal", async (edit) => {
  await mount();
  if (edit === "memo") {
    await act(async () => renderer.root.findByType("textarea").props.onChange({ target: { value: "edited" } }));
  } else if (edit === "amount") {
    await act(async () => renderer.root.findAllByType("input").find((i) => i.props.inputMode === "decimal")!.props.onChange({ target: { value: "200" } }));
  }
  await submit();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(picker("결제자").props.selected).toEqual([1, 2]);
  expect(text(renderer.root.findByProps({ role: "alert" }))).toContain("선택할 수 없는 멤버");
  expect(text(picker("결제자"))).toContain("승인 대기");
});

it("removes the same PENDING person independently from each role", async () => {
  await mount({ ...base, participantUserIds: [1, 2] });
  await act(async () => removeButton("결제자").props.onClick());
  expect(picker("결제자").props.selected).toEqual([1]);
  expect(picker("부담자").props.selected).toEqual([1, 2]);
  await submit();
  expect(mocks.save).not.toHaveBeenCalled();
  await act(async () => removeButton("부담자").props.onClick());
  await submit();
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ payerUserIds: [1], participantUserIds: [1] }), 10);
});

it.each(["결제자", "부담자"] as const)("reports a clear error when the last %s is removed", async (title) => {
  await mount({ ...base, payerUserIds: title === "결제자" ? [2] : [1], participantUserIds: title === "부담자" ? [2] : [1] });
  await act(async () => removeButton(title).props.onClick());
  expect(picker(title).props.selected).toEqual([]);
  await submit();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(text(renderer.root.findByProps({ role: "alert" }))).toContain("각각 한 명 이상");
});

it("cancels explicit removal without mutating source and restores it on reopen", async () => {
  const expense = structuredClone(base);
  await mount(expense);
  await act(async () => removeButton("결제자").props.onClick());
  await act(async () => renderer.root.findAllByType("button").find((b) => text(b) === "취소")!.props.onClick());
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(expense).toEqual(base);
  await act(async () => renderer.unmount());
  await mount(expense);
  expect(picker("결제자").props.selected).toEqual([1, 2]);
  expect(text(picker("결제자"))).toContain("승인 대기");
});

it("never offers PENDING in a new expense", async () => {
  await act(async () => { renderer = create(<ExpenseEditor initial={{}} onClose={mocks.close} />); });
  for (const title of ["결제자", "부담자"] as const) {
    expect(picker(title).props.selected).toEqual([]);
    expect(picker(title).findAllByType("input")).toHaveLength(2);
    expect(text(picker(title))).not.toContain("B");
    expect(text(picker(title))).not.toContain("D");
    expect(picker(title).findAllByType("button")).toHaveLength(0);
  }
});

it("preserves unknown roles, disallows copying/readding unknowns, and still selects LEFT", async () => {
  await mount({ ...base, payerUserIds: [1, 99], participantUserIds: [1, 98] });
  expect(text(picker("결제자"))).toContain("(알 수 없음)");
  expect(text(picker("결제자"))).not.toContain("#98");
  expect(text(picker("부담자"))).not.toContain("#99");
  await submit();
  expect(mocks.save).toHaveBeenLastCalledWith(expect.objectContaining({ payerUserIds: [1, 99], participantUserIds: [1, 98] }), 10);
  const labels = picker("결제자").findAllByType("label");
  await act(async () => labels.find((l) => text(l).includes("#99"))!.findByType("input").props.onChange({ target: { checked: false } }));
  expect(text(picker("결제자"))).not.toContain("#99");
  await act(async () => labels.find((l) => text(l).includes("나간 멤버"))!.findByType("input").props.onChange({ target: { checked: true } }));
  await submit();
  expect(mocks.save).toHaveBeenLastCalledWith(expect.objectContaining({ payerUserIds: [1, 3], participantUserIds: [1, 98] }), 10);
});

it.each(["pending", "error"] as MemberQueryStatus[])("does not infer membership or alter selections during member %s", async (memberStatus) => {
  await mount();
  mocks.state = { ...mocks.state, members: [], memberStatus };
  await act(async () => renderer.update(<ExpenseEditor initial={{ expense: base }} onClose={mocks.close} />));
  expect(renderer.root.findAllByType(ExpenseRolePicker)).toHaveLength(0);
  for (const label of ["승인 대기", "(알 수 없음)", "나간 멤버", "제외"]) expect(text(renderer.root)).not.toContain(label);
  expect(renderer.root.findByProps({ type: "submit" }).props.disabled).toBe(true);
  await submit();
  expect(mocks.save).not.toHaveBeenCalled();
  mocks.state = { ...mocks.state, members, memberStatus: "success" };
  await act(async () => renderer.update(<ExpenseEditor initial={{ expense: base }} onClose={mocks.close} />));
  expect(picker("결제자").props.selected).toEqual([1, 2]);
  expect(picker("부담자").props.selected).toEqual([1]);
  expect(text(picker("결제자"))).toContain("승인 대기");
});
