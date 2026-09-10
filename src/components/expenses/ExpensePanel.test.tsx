import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { ExpensePanel } from "./ExpensePanel";
const mocks = vi.hoisted(() => ({
  state: null as unknown,
  remove: vi.fn(),
  open: vi.fn(),
  refresh: vi.fn(),
}));

it("opens an expense in the selected trip day", async () => {
  await mount();
  mocks.open.mockClear();
  await act(async () =>
    renderer.root
      .findByType("select")
      .props.onChange({ target: { value: "10" } }),
  );
  const add = renderer.root
    .findAllByType("button")
    .find((b) => b.props["aria-label"] === "지출 추가");
  expect(add).toBeDefined();
  await act(async () => add!.props.onClick());
  expect(mocks.open).toHaveBeenCalledWith({ scheduleId: 10 });
});

it("keeps exact whole-trip currency totals visible while filtering", async () => {
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
  await act(async () => renderer.update(<ExpensePanel />));
  await act(async () =>
    renderer.root
      .findByType("select")
      .props.onChange({ target: { value: "PREPARATION" } }),
  );
  const text = JSON.stringify(renderer.toJSON());
  expect(text).toContain("999,999,999,999,999.99");
  expect(text).toContain("12,300");
});
vi.mock("./ExpenseProvider", () => ({
  useExpenseContext: () => mocks.state,
  ExpenseEntryButton: () => <button>준비 지출 추가</button>,
}));
let renderer: ReactTestRenderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.unstubAllGlobals();
});
async function mount() {
  const base = {
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
    busy: false,
    open: mocks.open,
    remove: mocks.remove,
    refresh: mocks.refresh,
  };
  mocks.remove.mockReset();
  await act(async () => {
    renderer = create(<ExpensePanel />);
  });
}
it("filters preparation and trip day without altering server summary scope", async () => {
  await mount();
  await act(async () =>
    renderer.root
      .findByType("select")
      .props.onChange({ target: { value: "PREPARATION" } }),
  );
  expect(renderer.root.findAllByType("li")).toHaveLength(1);
  expect(JSON.stringify(renderer.toJSON())).toContain("준비");
  expect(JSON.stringify(renderer.toJSON())).not.toContain("현장");
  await act(async () =>
    renderer.root
      .findAllByType("button")
      .find((b) => b.children.includes("정산 요약"))!
      .props.onClick(),
  );
  expect(JSON.stringify(renderer.toJSON())).toContain("방 전체 지출");
});
it("requires confirmation and preserves list with visible deletion failure", async () => {
  await mount();
  vi.stubGlobal(
    "confirm",
    vi.fn(() => false),
  );
  let button = renderer.root
    .findAllByType("button")
    .find((b) => b.children.includes("삭제"))!;
  await act(async () => button.props.onClick());
  expect(mocks.remove).not.toHaveBeenCalled();
  vi.stubGlobal("confirm", () => true);
  mocks.remove.mockRejectedValue(new Error("삭제 실패"));
  button = renderer.root
    .findAllByType("button")
    .find((b) => b.children.includes("삭제"))!;
  await act(async () => button.props.onClick());
  expect(JSON.stringify(renderer.toJSON())).toContain("삭제 실패");
  expect(renderer.root.findAllByType("li")).toHaveLength(2);
});

it("returns to all expenses when the selected day is deleted remotely", async () => {
  await mount();
  await act(async () =>
    renderer.root
      .findByType("select")
      .props.onChange({ target: { value: "10" } }),
  );
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
  await act(async () => renderer.update(<ExpensePanel />));
  expect(renderer.root.findByType("select").props.value).toBe("ALL");
  expect(renderer.root.findAllByType("li")).toHaveLength(1);
});
