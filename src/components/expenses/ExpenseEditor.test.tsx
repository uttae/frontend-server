import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import type { Expense } from "@/lib/api/rooms/expenses";
import { ExpenseEditor, type ExpenseEntry } from "./ExpenseEditor";
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  close: vi.fn(),
  state: null as unknown,
}));
vi.mock("./ExpenseProvider", () => ({ useExpenseContext: () => mocks.state }));
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
  mocks.close.mockReset();
  mocks.state = {
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
  );
  expect(mocks.close).toHaveBeenCalledOnce();
});
it("clears both links for preparation and clears place when changing day", async () => {
  await mount();
  const select = renderer.root.findAllByType("select")[0];
  await act(async () => select.props.onChange({ target: { value: "11" } }));
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
  );
  await mount();
  await act(async () =>
    renderer.root
      .findAllByType("select")[0]
      .props.onChange({ target: { value: "PREPARATION" } }),
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
  );
});
it("blocks wrong currency scale without truncating and guards rapid duplicate submit", async () => {
  await mount();
  const amount = renderer.root
    .findAllByType("input")
    .find((i) => i.props.inputMode === "decimal")!;
  await act(async () => amount.props.onChange({ target: { value: "10.001" } }));
  await act(async () =>
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
  expect(mocks.save).not.toHaveBeenCalled();
  await act(async () => amount.props.onChange({ target: { value: "10.01" } }));
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
    await act(async () => amount.props.onChange({ target: { value: "100" } }));
    for (const checkbox of renderer.root
      .findAllByType("input")
      .filter((i) => i.props.type === "checkbox"))
      await act(async () =>
        checkbox.props.onChange({ target: { checked: true } }),
      );
    await act(async () =>
      categorySelect().props.onChange({ target: { value: "OTHER" } }),
    );
    await act(async () =>
      renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
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
  );
  expect(mocks.close).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer.toJSON())).toContain("서버 검증 실패");
});

const categories = [
  ["FLIGHT", "항공"],
  ["ACCOMMODATION", "숙박"],
  ["FOOD", "식사"],
  ["TRANSPORT", "교통"],
  ["SHOPPING", "쇼핑"],
  ["SIGHTSEEING", "관광"],
  ["OTHER", "기타"],
] as const;
function categorySelect() {
  const selects = renderer.root
    .findAllByType("select")
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
    .filter((i) => i.props.type === "checkbox")) {
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
    categorySelect()
      .findAllByType("option")
      .filter((o) => o.props.value !== "")
      .map((o) => [o.props.value, o.children.join("")]),
  ).toEqual(categories);
});
it.each(categories)(
  "creates the selected category %s (%s)",
  async (category) => {
    await mount(null);
    await fillNewExpense();
    await act(async () =>
      categorySelect().props.onChange({ target: { value: category } }),
    );
    await act(async () =>
      renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
    );
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ category, totalAmount: "100" }),
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
      renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
    );
    expect(mocks.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ category }),
      10,
    );
    const replacement = category === "OTHER" ? "FLIGHT" : "OTHER";
    await act(async () =>
      categorySelect().props.onChange({ target: { value: replacement } }),
    );
    mocks.save.mockRejectedValueOnce(new Error("카테고리 저장 실패"));
    await act(async () =>
      renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }),
    );
    expect(mocks.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: replacement }),
      10,
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
          .find((b) => (b.props["aria-label"] ?? b.children.join("")) === path)!
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
        .find((b) => (b.props["aria-label"] ?? b.children.join("")) === label)!
        .props.disabled,
    ).toBe(true);
  }
  await act(async () =>
    renderer.root.findByType("dialog").props.onCancel({ preventDefault() {} }),
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
    renderer.root.findByType("dialog").props.onCancel({ preventDefault() {} }),
  );
  expect(opener.focus).toHaveBeenCalledOnce();
});
