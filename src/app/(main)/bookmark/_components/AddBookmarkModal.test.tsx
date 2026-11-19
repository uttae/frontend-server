// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { AddBookmarkModal } from "./AddBookmarkModal";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

async function renderModal(onSave = vi.fn()) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<AddBookmarkModal mode="create" initialFolder={null} onClose={vi.fn()} onSave={onSave} />));
  const titleInput = document.querySelector<HTMLInputElement>('[role="dialog"] input[type="text"]')!;
  const form = document.querySelector<HTMLFormElement>('[role="dialog"] form')!;
  return {
    titleInput,
    async typeTitle(value: string) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(titleInput, value);
        titleInput.dispatchEvent(new Event("input", { bubbles: true }));
      });
    },
    submit: () => act(async () => form.requestSubmit()),
    async unmount() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

it("shows the length error under the title on submit and saves the trimmed title once fixed", async () => {
  const onSave = vi.fn();
  const modal = await renderModal(onSave);
  try {
    await modal.typeTitle("가".repeat(51));
    await modal.submit();
    expect(onSave).not.toHaveBeenCalled();
    expect(modal.titleInput.getAttribute("aria-invalid")).toBe("true");
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toBe("제목은 50자까지 쓸 수 있어요.");

    await modal.typeTitle("  맛집  ");
    expect(modal.titleInput.hasAttribute("aria-invalid")).toBe(false);
    await modal.submit();
    expect(onSave).toHaveBeenCalledWith({ title: "맛집", color: "#EAB308" });
  } finally {
    await modal.unmount();
  }
});
