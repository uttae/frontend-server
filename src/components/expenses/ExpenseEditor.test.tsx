// Place-cache subscriptions are covered by ExpensePlaceLabel.test.tsx.
vi.mock("./ExpensePlaceLabel", () => ({ ExpensePlaceLabel: () => null }));
vi.mock("@/lib/api/config", () => ({ API_BASE: "http://fixture" }));
import { ExpenseSelect } from "./ExpenseSelect";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ExpenseApiError, type Expense } from "@/lib/api/rooms/expenses";
import { ExpenseEditor, type ExpenseEntry } from "./ExpenseEditor";
import { ExpenseCurrencyPicker } from "./ExpenseCurrencyPicker";
import { ExpenseRolePicker } from "./ExpenseViews";
beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  readLatest: vi.fn(),
  close: vi.fn(),
  state: null as unknown,
}));
vi.mock("./ExpenseProvider", () => ({
  useExpenseContext: () => mocks.state,
}));
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

function stubLocalStorage() {
  const entries = new Map<string, string>();
  const storage = {
    get length() { return entries.size; },
    key(index: number) { return [...entries.keys()][index] ?? null; },
    getItem(key: string) { return entries.get(key) ?? null; },
    setItem(key: string, value: string) { entries.set(key, value); },
    removeItem(key: string) { entries.delete(key); },
    clear() { entries.clear(); },
  };
  vi.stubGlobal("window", { localStorage: storage, matchMedia: () => ({ matches: true }) });
  return entries;
}

async function completeNewExpense() {
  const amount = renderer.root.findAllByType("input")
    .find((input) => input.props.inputMode === "decimal")!;
  const currency = renderer.root.findByType(ExpenseCurrencyPicker).props.value;
  await act(async () => amount.props.onChange({ target: { value: currency === "USD" ? "100.00" : "100" } }));
  await act(async () => categorySelect().props.onChange("OTHER"));
  await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
}

async function rerenderNewEditor() {
  await act(async () => renderer.unmount());
  await act(async () => { renderer = create(<ExpenseEditor initial={{}} onClose={mocks.close} />); });
}

it("remembers currency only after a successful new expense save", async () => {
  const entries = stubLocalStorage();
  await mount(null);
  expect(renderer.root.findByType(ExpenseCurrencyPicker).props.value).toBe("KRW");
  await act(async () => renderer.root.findByType(ExpenseCurrencyPicker).props.onChange("USD"));
  expect(entries.size).toBe(0);
  await completeNewExpense();
  expect(mocks.save).toHaveBeenCalledOnce();
  expect([...entries.values()]).toEqual(["USD"]);
  await mount(null);
  expect(renderer.root.findByType(ExpenseCurrencyPicker).props.value).toBe("USD");
});

it("does not remember cancelled, failed, or edited expense currency", async () => {
  const entries = stubLocalStorage();
  await mount(null);
  await act(async () => renderer.root.findByType(ExpenseCurrencyPicker).props.onChange("USD"));
  await act(async () => renderer.root.findByProps({ "aria-label": "닫기" }).props.onClick());
  expect(entries.size).toBe(0);
  mocks.save.mockRejectedValueOnce(new Error("저장 실패"));
  await completeNewExpense();
  expect(entries.size).toBe(0);
  await mount();
  await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
  expect(entries.size).toBe(0);
});

it("scopes the remembered currency to the authenticated user and room", async () => {
  stubLocalStorage();
  await mount(null);
  await act(async () => renderer.root.findByType(ExpenseCurrencyPicker).props.onChange("USD"));
  await completeNewExpense();
  mocks.state = { ...(mocks.state as object), currentUserId: 2 };
  await rerenderNewEditor();
  expect(renderer.root.findByType(ExpenseCurrencyPicker).props.value).toBe("KRW");
  mocks.state = { ...(mocks.state as object), currentUserId: 1, roomId: "another-room" };
  await rerenderNewEditor();
  expect(renderer.root.findByType(ExpenseCurrencyPicker).props.value).toBe("KRW");
  mocks.state = { ...(mocks.state as object), roomId: "r" };
  await rerenderNewEditor();
  expect(renderer.root.findByType(ExpenseCurrencyPicker).props.value).toBe("USD");
});

it("uses the current list for stale preference and reads tab changes on the next open", async () => {
  const entries = stubLocalStorage();
  await mount(null);
  await act(async () => renderer.root.findByType(ExpenseCurrencyPicker).props.onChange("USD"));
  await completeNewExpense();
  const key = [...entries.keys()][0];
  entries.set(key, "BAD");
  await rerenderNewEditor();
  expect(renderer.root.findByType(ExpenseCurrencyPicker).props.value).toBe("KRW");
  entries.set(key, "USD");
  await rerenderNewEditor();
  expect(renderer.root.findByType(ExpenseCurrencyPicker).props.value).toBe("USD");
  mocks.state = { ...(mocks.state as object), currencies: { data: [currencies[0]], isSuccess: true } };
  await rerenderNewEditor();
  expect(renderer.root.findByType(ExpenseCurrencyPicker).props.value).toBe("USD");
  entries.set(key, "KRW");
  await rerenderNewEditor();
  expect(renderer.root.findByType(ExpenseCurrencyPicker).props.value).toBe("USD");
});

it("applies preference after currencies load without replacing a later manual choice", async () => {
  const entries = stubLocalStorage();
  await mount(null);
  await act(async () => renderer.root.findByType(ExpenseCurrencyPicker).props.onChange("USD"));
  await completeNewExpense();
  mocks.state = { ...(mocks.state as object), currencies: { data: undefined, isSuccess: false } };
  await rerenderNewEditor();
  expect(renderer.root.findByType(ExpenseCurrencyPicker).props.value).toBe("");
  mocks.state = { ...(mocks.state as object), currencies: { data: currencies, isSuccess: true } };
  await act(async () => renderer.update(<ExpenseEditor initial={{}} onClose={mocks.close} />));
  expect(renderer.root.findByType(ExpenseCurrencyPicker).props.value).toBe("USD");
  await act(async () => renderer.root.findByType(ExpenseCurrencyPicker).props.onChange("KRW"));
  entries.set([...entries.keys()][0], "USD");
  mocks.state = { ...(mocks.state as object), currencies: { data: [...currencies], isSuccess: true } };
  await act(async () => renderer.update(<ExpenseEditor initial={{}} onClose={mocks.close} />));
  expect(renderer.root.findByType(ExpenseCurrencyPicker).props.value).toBe("KRW");
});

it("keeps the normal default when storage is unavailable or identity is missing", async () => {
  vi.stubGlobal("window", { get localStorage() { throw new Error("blocked"); } });
  await mount(null);
  expect(renderer.root.findByType(ExpenseCurrencyPicker).props.value).toBe("KRW");
  mocks.state = { ...(mocks.state as object), currentUserId: undefined };
  await rerenderNewEditor();
  expect(renderer.root.findByType(ExpenseCurrencyPicker).props.value).toBe("KRW");
});

it("preselects self in both roles for new expenses and keeps self first", async () => {
  await mount(null);
  const state = mocks.state as { members: { userId: number }[] };
  mocks.state = {
    ...state,
    currentUserId: 2,
    members: [
      ...state.members,
      {
        userId: 2,
        status: "ACTIVE",
        role: "MEMBER",
        nickname: "나",
        profileImageUrl: null,
      },
    ],
  };
  await act(async () =>
    renderer.update(
      <ExpenseEditor key="self" initial={{}} onClose={mocks.close} />,
    ),
  );
  for (const picker of renderer.root.findAllByType(ExpenseRolePicker)) {
    expect(picker.props.selected).toEqual([2]);
    expect(
      picker
        .findAll(
          (node) =>
            node.type === "span" && node.props["data-user-id"] !== undefined,
        )
        .map((node) => node.props["data-user-id"]),
    ).toEqual([2, 1]);
    await act(async () =>
      picker
        .findAllByType("input")[0]
        .props.onChange({ target: { checked: false } }),
    );
  }
  await act(async () =>
    renderer.update(
      <ExpenseEditor key="self" initial={{}} onClose={mocks.close} />,
    ),
  );
  for (const picker of renderer.root.findAllByType(ExpenseRolePicker))
    expect(picker.props.selected).toEqual([]);
});

it("formats typed amounts without changing exact submitted decimals", async () => {
  await mount();
  const amount = renderer.root
    .findAllByType("input")
    .find((i) => i.props.inputMode === "decimal")!;
  await act(async () =>
    amount.props.onChange({ target: { value: "999,999,999,999,999.99" } }),
  );
  expect(amount.props.value).toBe("999,999,999,999,999.99");
  await act(async () =>
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
  expect(mocks.save).toHaveBeenCalledWith(
    expect.objectContaining({ totalAmount: "999999999999999.99" }),
    10,
    0,
  );
});
const base = {
  expenseGroup: "TRIP_DAY" as const,
  scheduleId: 10,
  scheduleItemId: 100,
  totalAmount: "10.01",
  currency: "USD",
  category: "OTHER" as const,
  memo: "",
  payerUserIds: [1, 99],
  participantUserIds: [1],
  id: 10,
  version: 0,
  createdAt: "",
  updatedAt: "",
};
let renderer: ReactTestRenderer;
async function mount(
  original: Expense | null = base,
  entry: ExpenseEntry = {},
  createNodeMock?: (element: { type: unknown }) => unknown,
) {
  if (renderer) await act(async () => renderer.unmount());
  mocks.save.mockReset();
  mocks.readLatest.mockReset();
  mocks.close.mockReset();
  mocks.state = {
    currentUserId: 1,
    roomId: "r",
    members: [
      {
        userId: 1,
        status: "ACTIVE",
        role: "HOST",
        nickname: "하나",
        profileImageUrl: null,
      },
    ],
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
  await act(async () => {
    renderer = create(
      <ExpenseEditor
        initial={original ? { expense: original } : entry}
        onClose={mocks.close}
      />,
      createNodeMock ? { createNodeMock } : undefined,
    );
  });
}
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.unstubAllGlobals();
});
it("preserves original unknown payer and exact amount when editing", async () => {
  await mount();
  await act(async () =>
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
  expect(mocks.save).toHaveBeenCalledWith(
    expect.objectContaining({
      payerUserIds: [1, 99],
      participantUserIds: [1],
      totalAmount: "10.01",
      scheduleItemId: 100,
    }),
    10,
    0,
  );
  expect(mocks.close).toHaveBeenCalledOnce();
});
it("clears both links for preparation and clears place when changing day", async () => {
  await mount();
  const select = renderer.root.findAllByType(ExpenseSelect)[0];
  await act(async () => select.props.onChange("11"));
  await act(async () =>
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
  expect(mocks.save).toHaveBeenLastCalledWith(
    expect.objectContaining({
      expenseGroup: "TRIP_DAY",
      scheduleId: 11,
      scheduleItemId: null,
    }),
    10,
    0,
  );
  await mount();
  await act(async () =>
    renderer.root
      .findAllByType(ExpenseSelect)[0]
      .props.onChange("PREPARATION"),
  );
  await act(async () =>
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
  expect(mocks.save).toHaveBeenLastCalledWith(
    expect.objectContaining({
      expenseGroup: "PREPARATION",
      scheduleId: null,
      scheduleItemId: null,
    }),
    10,
    0,
  );
});
it("keeps the place selector visible but disabled for travel preparation", async () => {
  await mount(null);
  const placeSelect = () => renderer.root.findAllByType(ExpenseSelect)
    .find((select) => select.props.label === "연결 장소 (선택)");
  const placeLabel = () => renderer.root.findAllByType("p")
    .find((paragraph) => paragraph.children.join("") === "연결 장소 (선택)");

  expect(placeSelect()).toBeDefined();
  expect(placeSelect()!.props.disabled).toBe(true);
  expect(placeSelect()!.props.options).toEqual([{ value: "", label: "장소 연결 없음" }]);
  expect(placeSelect()!.findByType("button").props.disabled).toBe(true);
  expect(placeLabel()!.props.className).toContain("opacity-50");

  const daySelect = renderer.root.findAllByType(ExpenseSelect)[0];
  expect(daySelect.props.label).toBe("일차 구분");
  await act(async () => daySelect.props.onChange("10"));
  expect(placeSelect()!.props.disabled).toBe(false);
  expect(placeSelect()!.props.options).toContainEqual({ value: "100", label: "경복궁" });
  expect(placeLabel()!.props.className).not.toContain("opacity-50");

  await act(async () => daySelect.props.onChange("PREPARATION"));
  expect(placeSelect()!.props.disabled).toBe(true);
  expect(placeSelect()!.props.options).toEqual([{ value: "", label: "장소 연결 없음" }]);
  expect(placeLabel()!.props.className).toContain("opacity-50");
});
it("blocks wrong currency scale without truncating and guards rapid duplicate submit", async () => {
  await mount();
  const amount = renderer.root
    .findAllByType("input")
    .find((i) => i.props.inputMode === "decimal")!;
  await act(async () =>
    amount.props.onChange({ target: { value: "10.001" } }),
  );
  await act(async () =>
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
  expect(mocks.save).not.toHaveBeenCalled();
  await act(async () =>
    amount.props.onChange({ target: { value: "10.01" } }),
  );
  let finish!: () => void;
  mocks.save.mockImplementation(
    () =>
      new Promise<void>((r) => {
        finish = r;
      }),
  );
  await act(async () => {
    const submit = renderer.root.findByType("form").props.onSubmit;
    void submit({ preventDefault() {} });
    void submit({ preventDefault() {} });
  });
  expect(mocks.save).toHaveBeenCalledOnce();
  await act(async () => {
    finish();
  });
});
it("does not submit when members fail and shows failure without removing historical data", async () => {
  await mount();
  mocks.state = {
    ...(mocks.state as object),
    memberStatus: "error",
    canManage: false,
  };
  await act(async () =>
    renderer.update(
      <ExpenseEditor initial={{ expense: base }} onClose={mocks.close} />,
    ),
  );
  await act(async () =>
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
  expect(mocks.save).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer.toJSON())).not.toContain("(알 수 없음)");
});

it.each([
  [{}, "PREPARATION", null, null],
  [{ scheduleId: 10 }, "TRIP_DAY", 10, null],
  [{ scheduleId: 10, scheduleItemId: 100 }, "TRIP_DAY", 10, 100],
] as const)(
  "creates an expense from each real entry context %j",
  async (entry, expenseGroup, scheduleId, scheduleItemId) => {
    await mount(null, entry);
    const amount = renderer.root
      .findAllByType("input")
      .find((i) => i.props.inputMode === "decimal")!;
    await act(async () =>
      amount.props.onChange({ target: { value: "100" } }),
    );
    for (const checkbox of renderer.root
      .findAllByType("input")
      .filter((i) => i.props.type === "checkbox" && !i.props.checked))
      await act(async () =>
        checkbox.props.onChange({ target: { checked: true } }),
      );
    await act(async () => categorySelect().props.onChange("OTHER"));
    await act(async () =>
      renderer.root
        .findByType("form")
        .props.onSubmit({ preventDefault() {} }),
    );
    expect(mocks.save).toHaveBeenCalledWith(
      {
        expenseGroup,
        scheduleId,
        scheduleItemId,
        totalAmount: "100",
        currency: "KRW",
        category: "OTHER",
        memo: "",
        payerUserIds: [1],
        participantUserIds: [1],
      },
      undefined,
      undefined,
    );
  },
);
it("cannot re-add an unknown payer after deselection and keeps input on server rejection", async () => {
  await mount();
  const checkboxes = renderer.root
    .findAllByType("input")
    .filter((i) => i.props.type === "checkbox");
  expect(checkboxes).toHaveLength(3);
  await act(async () =>
    checkboxes[1].props.onChange({ target: { checked: false } }),
  );
  expect(
    renderer.root
      .findAllByType("input")
      .filter((i) => i.props.type === "checkbox"),
  ).toHaveLength(2);
  mocks.save.mockRejectedValue(new Error("서버 검증 실패"));
  await act(async () =>
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
  expect(mocks.save).toHaveBeenCalledWith(
    expect.objectContaining({ payerUserIds: [1], totalAmount: "10.01" }),
    10,
    0,
  );
  expect(mocks.close).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer.toJSON())).toContain("서버 검증 실패");
});

const categories = [
  ["FLIGHT", "항공"],
  ["ACCOMMODATION", "숙박"],
  ["FOOD", "식비"],
  ["TRANSPORT", "교통"],
  ["SHOPPING", "쇼핑"],
  ["SIGHTSEEING", "관광"],
  ["OTHER", "기타"],
] as const;
function categorySelect() {
  const selects = renderer.root
    .findAllByType(ExpenseSelect)
    .filter((node) => node.props.name === "category");
  expect(selects, "a category selector is available").toHaveLength(1);
  return selects[0];
}
async function fillNewExpense() {
  const amount = renderer.root
    .findAllByType("input")
    .find((i) => i.props.inputMode === "decimal")!;
  await act(async () => amount.props.onChange({ target: { value: "100" } }));
  for (const checkbox of renderer.root
    .findAllByType("input")
    .filter((i) => i.props.type === "checkbox" && !i.props.checked)) {
    await act(async () =>
      checkbox.props.onChange({ target: { checked: true } }),
    );
  }
}
it("requires explicit selection and offers exactly seven labeled categories in approved order", async () => {
  await mount(null);
  await fillNewExpense();
  await act(async () =>
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
  expect(mocks.save).not.toHaveBeenCalled();
  expect(categorySelect().props.value).toBe("");
  expect(
    categorySelect().props.options.map(
      (o: { value: string; label: string }) => [o.value, o.label],
    ),
  ).toEqual(categories);
});
it.each(categories)(
  "creates the selected category %s (%s)",
  async (category) => {
    await mount(null);
    await fillNewExpense();
    await act(async () => categorySelect().props.onChange(category));
    await act(async () =>
      renderer.root
        .findByType("form")
        .props.onSubmit({ preventDefault() {} }),
    );
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ category, totalAmount: "100" }),
      undefined,
      undefined,
    );
  },
);
it.each(categories)(
  "retains %s (%s) on edit and permits explicit reclassification",
  async (category) => {
    await mount({ ...base, category });
    expect(categorySelect().props.value).toBe(category);
    await act(async () =>
      renderer.root
        .findByType("form")
        .props.onSubmit({ preventDefault() {} }),
    );
    expect(mocks.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ category }),
      10,
      0,
    );
    const replacement = category === "OTHER" ? "FLIGHT" : "OTHER";
    await act(async () => categorySelect().props.onChange(replacement));
    mocks.save.mockRejectedValueOnce(new Error("카테고리 저장 실패"));
    await act(async () =>
      renderer.root
        .findByType("form")
        .props.onSubmit({ preventDefault() {} }),
    );
    expect(mocks.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: replacement }),
      10,
      0,
    );
    expect(categorySelect().props.value).toBe(replacement);
    expect(JSON.stringify(renderer.toJSON())).toContain("카테고리 저장 실패");
  },
);

// Model native modal focus separately from renderer nodes: closing alone does not
// restore focus here, matching the browser defect reported by Hermes.
async function mountWithOpener() {
  class FocusTarget {
    isConnected = true;
    focus = vi.fn(() => {
      ownerDocument.activeElement = this;
    });
  }
  const opener = new FocusTarget();
  const closeButton = new FocusTarget();
  const ownerDocument = { activeElement: opener };
  const nativeDialog = {
    ownerDocument,
    showModal: vi.fn(() => closeButton.focus()),
    close: vi.fn(),
  };
  vi.stubGlobal("HTMLElement", FocusTarget);
  await mount(base, {}, (element) =>
    element.type === "dialog" ? nativeDialog : null,
  );
  mocks.close.mockImplementation(() => renderer.unmount());
  expect(ownerDocument.activeElement).toBe(closeButton);
  return { opener, closeButton, ownerDocument, nativeDialog };
}

it.each(["Escape", "닫기", "취소", "save"])(
  "restores connected opener focus after %s closes the editor",
  async (path) => {
    const { opener, ownerDocument, nativeDialog } = await mountWithOpener();
    await act(async () => {
      if (path === "Escape") {
        const preventDefault = vi.fn();
        renderer.root.findByType("dialog").props.onCancel({ preventDefault });
        expect(preventDefault).toHaveBeenCalledOnce();
      } else if (path === "save") {
        await renderer.root
          .findByType("form")
          .props.onSubmit({ preventDefault() {} });
      } else {
        renderer.root
          .findAllByType("button")
          .find(
            (b) => (b.props["aria-label"] ?? b.children.join("")) === path,
          )!
          .props.onClick();
      }
    });
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(nativeDialog.close).toHaveBeenCalledOnce();
    expect(opener.focus).toHaveBeenCalledOnce();
    expect(ownerDocument.activeElement).toBe(opener);
  },
);

it("does not focus an opener removed while the editor was open", async () => {
  const { opener } = await mountWithOpener();
  opener.isConnected = false;
  await act(async () => renderer.unmount());
  expect(opener.focus).not.toHaveBeenCalled();
});

it("keeps focus in the editor and locks dismissal during save, then restores it on success", async () => {
  const { opener, closeButton, ownerDocument } = await mountWithOpener();
  let finish!: () => void;
  mocks.save.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => {
    void renderer.root
      .findByType("form")
      .props.onSubmit({ preventDefault() {} });
  });
  for (const label of ["닫기", "취소"]) {
    expect(
      renderer.root
        .findAllByType("button")
        .find(
          (b) => (b.props["aria-label"] ?? b.children.join("")) === label,
        )!.props.disabled,
    ).toBe(true);
  }
  await act(async () =>
    renderer.root
      .findByType("dialog")
      .props.onCancel({ preventDefault() {} }),
  );
  expect(mocks.close).not.toHaveBeenCalled();
  expect(opener.focus).not.toHaveBeenCalled();
  expect(ownerDocument.activeElement).toBe(closeButton);
  await act(async () => finish());
  expect(opener.focus).toHaveBeenCalledOnce();
});

it("keeps the editor focused on save rejection and restores focus on later dismissal", async () => {
  const { opener, closeButton, ownerDocument } = await mountWithOpener();
  mocks.save.mockRejectedValueOnce(new Error("저장 실패"));
  await act(async () =>
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
  expect(mocks.close).not.toHaveBeenCalled();
  expect(opener.focus).not.toHaveBeenCalled();
  expect(ownerDocument.activeElement).toBe(closeButton);
  await act(async () =>
    renderer.root
      .findByType("dialog")
      .props.onCancel({ preventDefault() {} }),
  );
  expect(opener.focus).toHaveBeenCalledOnce();
});

async function submitVersioned() {
  await act(async () =>
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
}
function recoveryButton(label: string) {
  return renderer.root
    .findAllByType("button")
    .find((b) => b.children.includes(label));
}
it("keeps the opened version when background list and entry refresh", async () => {
  await mount();
  mocks.state = {
    ...(mocks.state as object),
    list: { isSuccess: true, data: [{ ...base, version: 9 }] },
  };
  await act(async () =>
    renderer.update(
      <ExpenseEditor
        initial={{ expense: { ...base, version: 9 } }}
        onClose={mocks.close}
      />,
    ),
  );
  await submitVersioned();
  expect(mocks.save).toHaveBeenLastCalledWith(expect.anything(), 10, 0);
});
it("retains the draft and requires explicit latest-record review before saving again", async () => {
  await mount();
  await act(async () =>
    renderer.root
      .findByType("textarea")
      .props.onChange({ target: { value: "my draft" } }),
  );
  mocks.save.mockRejectedValueOnce(
    new ExpenseApiError(409, "EXPENSE_CONFLICT", "changed"),
  );
  mocks.readLatest.mockResolvedValueOnce({
    ...base,
    version: 2,
    memo: "remote memo",
  });
  await submitVersioned();
  expect(mocks.readLatest).toHaveBeenCalledWith(10);
  expect(mocks.close).not.toHaveBeenCalled();
  expect(renderer.root.findByType("textarea").props.value).toBe("my draft");
  expect(JSON.stringify(renderer.toJSON())).toContain("remote memo");
  await submitVersioned();
  expect(mocks.save).toHaveBeenCalledTimes(1);
  await act(async () =>
    recoveryButton("최신 비용 확인 후 수정 계속")!.props.onClick(),
  );
  expect(mocks.save).toHaveBeenCalledTimes(1);
  await submitVersioned();
  expect(mocks.save).toHaveBeenLastCalledWith(
    expect.objectContaining({
      memo: "my draft",
      payerUserIds: [1, 99],
      totalAmount: "10.01",
    }),
    10,
    2,
  );
});
it.each([undefined, { ...base, version: 2, scheduleId: 11 }])(
  "blocks retry for a deleted or moved conflict target",
  async (latest) => {
    await mount();
    mocks.save.mockRejectedValueOnce(
      new ExpenseApiError(409, "EXPENSE_CONFLICT", "changed"),
    );
    mocks.readLatest.mockResolvedValueOnce(latest);
    await submitVersioned();
    await submitVersioned();
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(recoveryButton("최신 비용 확인 후 수정 계속")).toBeUndefined();
    expect(mocks.close).not.toHaveBeenCalled();
  },
);
it("blocks save after failed conflict read until a fresh read and explicit review", async () => {
  await mount();
  mocks.save.mockRejectedValueOnce(
    new ExpenseApiError(409, "EXPENSE_CONFLICT", "changed"),
  );
  mocks.readLatest.mockRejectedValueOnce(new Error("offline"));
  await submitVersioned();
  await submitVersioned();
  expect(mocks.save).toHaveBeenCalledTimes(1);
  mocks.readLatest.mockResolvedValueOnce({ ...base, version: 3 });
  await act(async () =>
    recoveryButton("최신 비용 다시 조회")!.props.onClick(),
  );
  expect(mocks.save).toHaveBeenCalledTimes(1);
  await act(async () =>
    recoveryButton("최신 비용 확인 후 수정 계속")!.props.onClick(),
  );
  await submitVersioned();
  expect(mocks.save).toHaveBeenLastCalledWith(expect.anything(), 10, 3);
});
it.each([{ data: [] }, { data: [{ ...base, version: 1, scheduleId: 11 }] }])(
  "blocks saving a target already known deleted or moved",
  async ({ data }) => {
    await mount();
    mocks.state = {
      ...(mocks.state as object),
      list: { isSuccess: true, data },
    };
    await act(async () =>
      renderer.update(
        <ExpenseEditor initial={{ expense: base }} onClose={mocks.close} />,
      ),
    );
    await submitVersioned();
    expect(mocks.save).not.toHaveBeenCalled();
  },
);

it("reveals every save failure, including a repeated error message", async () => {
  const scrollIntoView = vi.fn();
  await mount(base, {}, element => element.type === "p" ? { scrollIntoView } : null);
  mocks.save.mockRejectedValue(new Error("저장 실패"));
  const submit = () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} });
  await act(async () => { await submit(); });
  expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
  await act(async () => { await submit(); });
  expect(scrollIntoView).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(renderer.toJSON())).toContain("저장 실패");
});

it("reveals repeated validation errors without smooth scrolling when reduced motion is requested", async () => {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
  const scrollIntoView = vi.fn();
  await mount(null, {}, element => element.type === "p" ? { scrollIntoView } : null);
  for (let attempt = 0; attempt < 2; attempt++) {
    await act(async () => {
      await renderer.root.findByType("form").props.onSubmit({ preventDefault() {} });
    });
  }
  expect(scrollIntoView).toHaveBeenCalledTimes(2);
  expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest", behavior: "instant" });
  expect(mocks.save).not.toHaveBeenCalled();
});
