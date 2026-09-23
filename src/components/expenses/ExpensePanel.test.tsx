vi.mock("@/lib/api/config", () => ({ API_BASE: "http://fixture" }));
import { ExpenseSelect } from "./ExpenseSelect";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ExpenseApiError, type Expense } from "@/lib/api/rooms/expenses";
import { ExpensePanel } from "./ExpensePanel";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
const mocks = vi.hoisted(() => ({
  state: null as unknown,
  remove: vi.fn(),
  readLatest: vi.fn(),
  open: vi.fn(),
  refresh: vi.fn(),
}));

it("opens an expense in the selected trip day", async () => {
  await mount();
  mocks.open.mockClear();
  await act(async () =>
    renderer.root.findByType(ExpenseSelect).props.onChange("10"),
  );
  const add = renderer.root
    .findAllByType("button")
    .find((b) => b.props["aria-label"] === "비용 추가");
  expect(add).toBeDefined();
  await act(async () => add!.props.onClick());
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
  await act(async () => renderer.update(<ExpensePanel />));
  await act(async () =>
    renderer.root.findByType(ExpenseSelect).props.onChange("PREPARATION"),
  );
  const text = JSON.stringify(renderer.toJSON());
  expect(text).not.toContain("999,999,999,999,999.99");
  expect(text).not.toContain("12,300");
  expect(text).toContain("501");
  expect(text.match(/여행 전체 지출/g)).toHaveLength(1);
  expect(text).not.toContain("원화 참고 지출");
});
vi.mock("./ExpenseProvider", () => ({
  useExpenseContext: () => mocks.state,
  ExpenseEntryButton: () => <button>준비 비용 추가</button>,
}));
vi.mock("@/components/settings/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
}));
let renderer: ReactTestRenderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
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
  await act(async () => {
    renderer = create(<ExpensePanel />);
  });
}
it("filters preparation and trip day without altering server summary scope", async () => {
  await mount();
  await act(async () =>
    renderer.root.findByType(ExpenseSelect).props.onChange("PREPARATION"),
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
  expect(JSON.stringify(renderer.toJSON())).not.toContain("방 전체 지출을 기준으로 정산해요.");
});
it("requires confirmation and preserves list with visible deletion failure", async () => {
  await mount();
  let button = renderer.root
    .findAllByType("button")
    .find((b) => b.props["aria-label"] === "비용 삭제")!;
  await act(async () => button.props.onClick());
  await answerConfirm(false);
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(renderer.root.findAllByType(ConfirmDialog)).toHaveLength(0);
  mocks.remove.mockRejectedValue(new Error("삭제 실패"));
  button = renderer.root
    .findAllByType("button")
    .find((b) => b.props["aria-label"] === "비용 삭제")!;
  await act(async () => button.props.onClick());
  await answerConfirm(true);
  expect(JSON.stringify(renderer.toJSON())).toContain("삭제 실패");
  expect(renderer.root.findAllByType("li")).toHaveLength(2);
});

it("returns to all expenses when the selected day is deleted remotely", async () => {
  await mount();
  await act(async () =>
    renderer.root.findByType(ExpenseSelect).props.onChange("10"),
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
  expect(renderer.root.findByType(ExpenseSelect).props.value).toBe("ALL");
  expect(renderer.root.findAllByType("li")).toHaveLength(1);
});

async function answerConfirm(confirmed: boolean) {
  const dialog = renderer.root.findByType(ConfirmDialog);
  await act(async () =>
    confirmed ? dialog.props.onConfirm() : dialog.props.onCancel(),
  );
}
function panelButton(label: string) {
  return renderer.root
    .findAllByType("button")
    .find((b) => b.children.includes(label) || (label === "삭제" && b.props["aria-label"] === "비용 삭제"));
}
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
  await act(async () => panelButton("삭제")!.props.onClick());
  await answerConfirm(true);
  expect(mocks.readLatest).toHaveBeenCalledWith(1);
  expect(mocks.remove).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(renderer.toJSON())).toContain("remote delete review");
  mocks.state = {
    ...state,
    list: {
      ...state.list,
      data: [{ ...latest, version: 4 }, state.list.data[1]],
    },
  };
  await act(async () => renderer.update(<ExpensePanel />));
  await act(async () => panelButton("최신 지출 확인 후 삭제")!.props.onClick());
  await answerConfirm(false);
  expect(mocks.remove).toHaveBeenCalledTimes(1);
  await act(async () => panelButton("최신 지출 확인 후 삭제")!.props.onClick());
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
    await act(async () => panelButton("삭제")!.props.onClick());
    await answerConfirm(true);
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    expect(panelButton("최신 지출 확인 후 삭제")).toBeUndefined();
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
  await act(async () => renderer.update(<ExpensePanel />));
  expect(JSON.stringify(renderer.toJSON())).toContain("여행 전체 예산");
  expect(renderer.root.findAllByProps({ "aria-label": "예산 비교" })).toHaveLength(0);
  await act(async () =>
    renderer.root
      .findAllByType("button")
      .find((b) => b.children.includes("정산 요약"))!
      .props.onClick(),
  );
  const rendered = JSON.stringify(renderer.toJSON());
  expect(rendered).toContain("0.50");
  expect(rendered).toContain("USD");
  expect(rendered).toContain("KRW 정산");
  expect(rendered).toContain("500");
  expect(rendered).not.toContain("참고 잔여 예산");
  expect(rendered).not.toContain("통화별로 따로 정산");
  expect(rendered).not.toContain("아래 금액을 확인하고 직접 송금");
});
it("closes the expense panel after room access is revoked", async () => {
  await mount();
  mocks.state = { ...(mocks.state as object), revoked: true };
  await act(async () => renderer.update(<ExpensePanel />));
  expect(renderer.toJSON()).toBeNull();
});


it.each(["ready", "pending", "disconnected"])(
  "does not offer a manual expense refresh while sync is %s",
  async (syncStatus) => {
    await mount();
    mocks.state = { ...(mocks.state as object), syncStatus };
    await act(async () => renderer.update(<ExpensePanel />));
    expect(renderer.root.findAllByType("button").filter((button) =>
      /새로고침|조회 다시 시도/.test(button.props["aria-label"] ?? ""),
    )).toHaveLength(0);
    const rendered = JSON.stringify(renderer.toJSON());
    expect(rendered).not.toContain("새로고침");
    if (syncStatus === "disconnected") expect(rendered).toContain("연결 복구 안내");
    if (syncStatus === "pending") expect(rendered).toContain("최신 지출 확인 중");
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
    await act(async () => renderer.update(<ExpensePanel />));
    expect(JSON.stringify(renderer.toJSON())).not.toContain("새로고침");
    const retry = () => renderer.root.findAllByType("button")
      .find((button) => /조회 다시 시도/.test(button.props["aria-label"] ?? ""));
    expect(retry()).toBeDefined();
    let finish!: () => void;
    mocks.refresh.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    await act(async () => retry()!.props.onClick());
    expect(retry()!.props.disabled).toBe(true);
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
      await act(async () => renderer.update(<ExpensePanel />));
      expect(JSON.stringify(renderer.toJSON())).toContain(
        scenario === "reconnect" ? "연결 복구 안내" : "최신 지출 확인 중",
      );
      mocks.state = healthy;
      await act(async () => renderer.update(<ExpensePanel />));
    }
    const section = renderer.root.findByProps({ "aria-label": "지출 및 정산" });
    const first = section.children[0];
    expect(typeof first).not.toBe("string");
    if (typeof first === "string") throw new Error("Expected panel heading");
    expect(first.findAllByType("h1").map((heading) => heading.children.join("")))
      .toEqual(["가계부"]);
    expect(JSON.stringify(renderer.toJSON())).not.toMatch(/최근 지출 조회 완료|30초 간격/);
  },
);

it("switches from my settlement to all transfers and keeps analysis in a separate view", async () => {
  await mount();
  mocks.state = {
    ...(mocks.state as object), currentUserId: 1,
    summary: { isSuccess: true, data: { currencies: [{
      currency: "KRW", totalAmount: "12345", individuals: [], days: [],
      categories: [{ category: "FOOD", totalAmount: "12345" }],
      transfers: [{ fromUserId: 3, toUserId: 4, amount: "12345" }],
    }] } },
  };
  await act(async () => renderer.update(<ExpensePanel />));
  const click = async (label: string) => act(async () => {
    renderer.root.findAllByType("button").find(b => b.children.includes(label))!.props.onClick();
  });
  await click("정산 요약");
  expect(JSON.stringify(renderer.toJSON())).toContain("주고받을 금액이 없어요");
  expect(JSON.stringify(renderer.toJSON())).not.toContain("12,345");
  await click("전체 정산");
  expect(JSON.stringify(renderer.toJSON())).toContain("12,345");
  expect(JSON.stringify(renderer.toJSON())).not.toContain("카테고리별");
  await click("비용 분석");
  expect(JSON.stringify(renderer.toJSON())).toContain("카테고리별");
  expect(JSON.stringify(renderer.toJSON())).not.toContain("정산 범위");
});

it.each([
  ["disconnected", "실시간 연결이 끊겼어요."],
  ["error", "최신 상태 확인에 실패했어요."],
  ["pending", "최신 지출 확인 중…"],
])("announces %s sync status with a native block output", async (syncStatus, message) => {
  await mount();
  mocks.state = { ...(mocks.state as object), syncStatus };
  await act(async () => renderer.update(<ExpensePanel />));
  const output = renderer.root.findAllByType("output").find(node => node.children.join("").startsWith(message));
  expect(output).toBeDefined();
  expect(output!.props.style).toEqual({ display: "block" });
});
