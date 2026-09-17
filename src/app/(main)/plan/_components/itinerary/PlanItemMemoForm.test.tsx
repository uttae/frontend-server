// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const save = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useRooms", () => ({ useUpdateScheduleItem: () => ({ mutateAsync: save, isPending: false }), useScheduleItemSaving: () => false }));
vi.mock("@/lib/api/config", () => ({ API_BASE: "http://fixture.test" }));
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/query-client";
import { PlanItemMemoEditor, PlanItemMemoReadOnly } from "./PlanItemMemoForm";
let root: Root;
let host: HTMLDivElement;
beforeEach(() => { save.mockReset(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe("memo Markdown", () => {
  it("renders text, newlines, titled and automatic links with safe protocols", () => {
    act(() => root.render(<PlanItemMemoReadOnly memo={'first\nsecond [title](https://example.com) https://example.org www.example.net\n[bad](javascript:alert%281%29) <script>alert(1)</script>'} />));
    expect(host.textContent).toContain("first");
    expect(host.querySelector("br")).not.toBeNull();
    expect(host.querySelector('a[href="https://example.com"]')?.textContent).toBe("title");
    expect(host.querySelector('a[href="https://example.org"]')).not.toBeNull();
    expect(host.querySelectorAll("a").length).toBe(3);
    expect(host.querySelector("script")).toBeNull();
    expect(host.innerHTML).not.toContain('href="javascript:');
  });
  it("toggles the exact nested duplicate task marker and ignores fenced task text", () => {
    const memo = '- [ ] same\n  - [x] same\n- [ ] same\n\n```\n- [ ] same\n```';
    const onToggle = vi.fn();
    act(() => root.render(<PlanItemMemoReadOnly memo={memo} onToggle={onToggle} />));
    const boxes = host.querySelectorAll('input[type="checkbox"]');
    expect(boxes.length).toBe(3);
    expect((boxes[1] as HTMLInputElement).checked).toBe(true);
    act(() => (boxes[1] as HTMLInputElement).click());
    expect(onToggle).toHaveBeenCalledWith('- [ ] same\n  - [ ] same\n- [ ] same\n\n```\n- [ ] same\n```');
  });
  it("disables tasks while saving or without editing permission", () => {
    act(() => root.render(<PlanItemMemoReadOnly memo="- [ ] wait" onToggle={vi.fn()} isDeleting />));
    expect((host.querySelector("input") as HTMLInputElement).disabled).toBe(true);
    act(() => root.render(<PlanItemMemoReadOnly memo="- [ ] wait" />));
    expect((host.querySelector("input") as HTMLInputElement).disabled).toBe(true);
  });
});

function edit(value: string) {
  const textarea = host.querySelector("textarea")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function button(text: string) { return [...host.querySelectorAll("button")].find((b) => b.textContent === text)!; }

describe("memo editing", () => {
  it("keeps the editor layout passive around its native checklist button", () => {
    const qc = createQueryClient();
    const clicks = vi.fn();
    const keys = vi.fn();
    document.body.addEventListener("click", clicks);
    document.body.addEventListener("keydown", keys);
    act(() => root.render(<QueryClientProvider client={qc}>
      <PlanItemMemoEditor roomId="r" scheduleId={10} itemId={4} memo="old" memoVersion={2} onClose={() => {}} />
    </QueryClientProvider>));

    const add = button("체크리스트 추가");
    add.focus();
    expect(document.activeElement).toBe(add);
    act(() => add.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(keys).toHaveBeenCalledTimes(1);
    // jsdom does not synthesize the browser's keyboard activation click.
    act(() => add.click());
    expect(host.querySelector('textarea[aria-label="일정 메모"]')?.getAttribute("aria-label")).toBe("일정 메모");
    expect(host.querySelector("textarea")!.value).toBe("old\n- [ ] ");
    document.body.removeEventListener("click", clicks);
    document.body.removeEventListener("keydown", keys);
    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it("adopts a remote update while the editor is still clean", () => {
    const qc = createQueryClient();
    const render = (memo: string, version: number) =>
      root.render(
        <QueryClientProvider client={qc}>
          <PlanItemMemoEditor
            roomId="r"
            scheduleId={10}
            itemId={3}
            memo={memo}
            memoVersion={version}
            onClose={() => {}}
          />
        </QueryClientProvider>,
      );

    act(() => render("old", 2));
    act(() => render("remote", 3));

    expect(host.querySelector("textarea")!.value).toBe("remote");
    expect(button("저장").disabled).toBe(true);
  });

  it("adds checklist syntax and sends the original version", async () => {
    const qc = createQueryClient(); save.mockResolvedValue({ memo: "old\n- [ ] ", memoVersion: 3 });
    act(() => root.render(<QueryClientProvider client={qc}><PlanItemMemoEditor roomId="r" scheduleId={10} itemId={1} memo="old" memoVersion={2} onClose={() => {}} /></QueryClientProvider>));
    act(() => button("체크리스트 추가").click());
    expect(host.querySelector("textarea")!.value).toBe("old\n- [ ] ");
    await act(async () => button("저장").click());
    expect(save).toHaveBeenCalledWith({ roomId: "r", scheduleId: 10, itemId: 1, body: { memo: "old\n- [ ] ", expectedMemoVersion: 2 } });
  });
  it("preserves a draft during remote updates and requires a reviewed version", async () => {
    const qc = createQueryClient();
    const render = (memo: string, version: number) => root.render(<QueryClientProvider client={qc}><PlanItemMemoEditor roomId="r" scheduleId={10} itemId={2} memo={memo} memoVersion={version} onClose={() => {}} /></QueryClientProvider>);
    act(() => render("old", 2)); edit("my draft"); act(() => render("remote", 3));
    expect(host.querySelector("textarea")!.value).toBe("my draft");
    act(() => button("저장").click());
    expect(save).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain("remote");
    act(() => render("newer", 4));
    save.mockResolvedValue({ memo: "my draft", memoVersion: 5 });
    await act(async () => button("확인").click());
    expect(save.mock.calls[0][0].body).toEqual({ memo: "my draft", expectedMemoVersion: 3 });
  });
});
