// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { MobileMemoSheet } from "./MobileMemoSheet";

const state = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/hooks/useRooms", () => ({
  useUpdateScheduleItem: () => ({ mutateAsync: state.update, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => vi.clearAllMocks());

// 시트는 Base UI Drawer라 document.body로 포털된다
async function renderSheet() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <MobileMemoSheet roomId="r" scheduleId={1} itemId={2} placeName="장소" memo="" onClose={vi.fn()} />,
    ),
  );
  const textarea = document.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')!;
  return {
    textarea,
    async type(value: string) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, value);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      });
    },
    save: () =>
      act(async () => document.querySelector<HTMLFormElement>('[role="dialog"] form')!.requestSubmit()),
    text: () => document.querySelector('[role="dialog"]')!.textContent ?? "",
    async unmount() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

it("shows the count and the length error while typing and does not cut or save an over-long memo", async () => {
  const sheet = await renderSheet();
  try {
    await sheet.type("가".repeat(2001));
    expect(sheet.textarea.value).toHaveLength(2001);
    expect(sheet.textarea.getAttribute("aria-invalid")).toBe("true");
    expect(sheet.text()).toContain("메모는 2000자 이하여야 해요.");
    expect(sheet.text()).toContain("2001/2000");
    await sheet.save();
    expect(state.update).not.toHaveBeenCalled();

    await sheet.type("  예약 번호 123  ");
    expect(sheet.textarea.hasAttribute("aria-invalid")).toBe(false);
    await sheet.save();
    expect(state.update).toHaveBeenCalledWith({ roomId: "r", scheduleId: 1, itemId: 2, body: { memo: "예약 번호 123" } });
  } finally {
    await sheet.unmount();
  }
});
