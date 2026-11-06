// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import type { ConfirmDialog } from "@/components/settings/ConfirmDialog";

import { PlanItemMemoEditor } from "./PlanItemMemoForm";

const state = vi.hoisted(() => ({
  update: vi.fn(),
  confirm: null as ComponentProps<typeof ConfirmDialog> | null,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock("@/hooks/useRooms", () => ({
  useUpdateScheduleItem: () => ({ mutateAsync: state.update, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { error: state.toastError, success: state.toastSuccess } }));
vi.mock("@/components/settings/ConfirmDialog", () => ({
  ConfirmDialog: (props: ComponentProps<typeof ConfirmDialog>) => {
    state.confirm = props;
    return <div data-confirm />;
  },
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => {
  vi.clearAllMocks();
  state.confirm = null;
});

const props = { roomId: "r", scheduleId: 1, itemId: 2, onClose: vi.fn() };
const textarea = (container: HTMLElement) => container.querySelector("textarea")!;
const saveButton = (container: HTMLElement) =>
  [...container.querySelectorAll("button")].find((button) => button.textContent === "저장")!;
async function type(container: HTMLElement, value: string) {
  const input = textarea(container);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function setup(memo: string) {
  const container = document.createElement("div");
  const root = createRoot(container);
  const render = (next: string) => act(async () => root.render(<PlanItemMemoEditor {...props} memo={next} />));
  await render(memo);
  return { container, render, unmount: () => act(async () => root.unmount()) };
}

it("refills with the server memo while untouched and asks before overwriting a changed memo", async () => {
  const { container, render, unmount } = await setup("A");
  try {
    // 고치지 않았으면 서버 새 값으로 다시 채운다
    await render("B");
    expect(textarea(container).value).toBe("B");
    expect(saveButton(container).disabled).toBe(true);

    // 고치는 중에 서버 값이 바뀌면 입력은 지키고, 저장할 때 덮어쓰기를 묻는다
    await type(container, "내 메모 ");
    await render("C");
    expect(textarea(container).value).toBe("내 메모 ");
    await act(async () => saveButton(container).click());
    expect(state.update).not.toHaveBeenCalled();
    expect(container.querySelector("[data-confirm]")).not.toBeNull();
    await act(async () => state.confirm!.onConfirm());
    expect(state.update).toHaveBeenCalledWith({ roomId: "r", scheduleId: 1, itemId: 2, body: { memo: "내 메모" } });
  } finally {
    await unmount();
  }
});

it("refills with the latest server memo once the draft is reverted to the start value", async () => {
  const { container, render, unmount } = await setup("A");
  try {
    await type(container, "AB");
    await render("C");
    expect(textarea(container).value).toBe("AB");
    await type(container, "A");
    expect(textarea(container).value).toBe("C");
    expect(saveButton(container).disabled).toBe(true);
  } finally {
    await unmount();
  }
});

it("shows the length error under the memo instead of a toast", async () => {
  const { container, unmount } = await setup("");
  try {
    // 한글 조합 중 maxLength를 넘어 들어온 값
    await type(container, "가".repeat(2001));
    await act(async () => saveButton(container).click());
    expect(state.update).not.toHaveBeenCalled();
    expect(state.toastError).not.toHaveBeenCalled();
    expect(textarea(container).getAttribute("aria-invalid")).toBe("true");
    expect(textarea(container).getAttribute("aria-describedby")).toBe(container.querySelector("[role=alert]")?.id);
    expect(container.querySelector("[role=alert]")?.textContent).toBe("메모는 2000자 이하여야 해요.");
    await type(container, "가".repeat(2000));
    expect(textarea(container).hasAttribute("aria-invalid")).toBe(false);
  } finally {
    await unmount();
  }
});
