// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClientProvider, useQuery, type QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/lib/query-client";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
import type { PlanPlace } from "@/lib/plan/types";
import { usePlanMemoDraftsStore } from "@/stores/plan-memo-drafts-store";
const transport = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ apiFetch: transport }));
vi.mock("@/lib/api/config", () => ({ API_BASE: "http://fixture.test" }));
import { PlanItemMemoDisplay, PlanItemMemoEditor, PlanMemoDraftRecovery } from "./PlanItemMemoForm";
let host: HTMLDivElement;
let root: Root;
let qc: QueryClient;
const key = scheduleItemsQueryKey("r", 10);
const item = { itemId: 1, scheduleId: 10, googlePlaceId: "p", startTime: null, endTime: null, memo: "- [ ] task", memoVersion: 2, orderIndex: 0, travelMode: "DRIVING", createdAt: "2026-09-17T00:00:00Z" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
function Harness({ editing = false }: { editing?: boolean }) {
  const { data = [] } = useQuery<PlanPlace[]>({ queryKey: key, enabled: false });
  return <><PlanMemoDraftRecovery roomId="r" />{data.map((p) => editing
    ? <PlanItemMemoEditor key={p.itemId} roomId="r" scheduleId={10} itemId={p.itemId!} memo={p.memo} memoVersion={p.memoVersion} onClose={() => {}} />
    : <PlanItemMemoDisplay key={p.itemId} roomId="r" scheduleId={10} itemId={p.itemId!} memo={p.memo} memoVersion={p.memoVersion} />)}</>;
}
async function render(editing = false) { await act(async () => { root.render(<QueryClientProvider client={qc}><Harness editing={editing} /></QueryClientProvider>); }); }
async function settle(action: () => void = () => {}) { await act(async () => { action(); await new Promise((resolve) => setTimeout(resolve, 10)); }); }
function button(text: string) { return [...host.querySelectorAll("button")].find((b) => b.textContent === text)!; }
function draft(value: string) {
  const t = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="일정 메모"]')!;
  act(() => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(t, value); t.dispatchEvent(new Event("input", { bubbles: true })); });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); transport.mockReset(); usePlanMemoDraftsStore.setState({ drafts: {} });
  qc = createQueryClient(); qc.setQueryData(key, [{ ...item, id: "item-1", title: "place" }]);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); qc.clear(); host.remove(); vi.unstubAllGlobals(); });

describe("real memo component save flow", () => {
  it("autosaves a task once, disables duplicate actions, and persists the server version on reopening", async () => {
    let finish!: (response: Response) => void; transport.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await render(); await settle(() => host.querySelector<HTMLInputElement>('input')!.click());
    expect(host.querySelector<HTMLInputElement>('input')!.disabled).toBe(true);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual({ memo: "- [x] task", expectedMemoVersion: 2 });
    await settle(() => finish(json({ ...item, memo: "- [x] task", memoVersion: 3 })));
    expect(host.querySelector<HTMLInputElement>('input')!.checked).toBe(true);
    await render(true);
    expect(host.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("- [x] task");
    expect(qc.getQueryData(key)).toMatchObject([{ memoVersion: 3 }]);
  });
  it("rolls back a failed checkbox and shows an error", async () => {
    transport.mockRejectedValue(new Error("offline")); await render();
    await settle(() => host.querySelector<HTMLInputElement>('input')!.click());
    expect(host.querySelector<HTMLInputElement>('input')!.checked).toBe(false);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("offline");
  });
  it("requires a second explicit check after 409 and fetches the latest source", async () => {
    transport.mockResolvedValueOnce(json({ code: "SCHEDULE_MEMO_CONFLICT", message: "changed" }, 409))
      .mockResolvedValueOnce(json([{ ...item, memo: "- [ ] remote", memoVersion: 3 }]))
      .mockResolvedValueOnce(json({ ...item, memo: "- [x] remote", memoVersion: 4 }));
    await render(); await settle(() => host.querySelector<HTMLInputElement>('input')!.click());
    expect(transport).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("remote");
    await settle(() => host.querySelector<HTMLInputElement>('input')!.click());
    expect(transport).toHaveBeenCalledTimes(3);
    expect(JSON.parse(transport.mock.calls[2][1].body)).toEqual({ memo: "- [x] remote", expectedMemoVersion: 3 });
  });
  it("preserves a stale editor draft after 409 until explicit overwrite confirmation", async () => {
    transport.mockResolvedValueOnce(json({ code: "SCHEDULE_MEMO_CONFLICT", message: "changed" }, 409))
      .mockResolvedValueOnce(json([{ ...item, memo: "remote body", memoVersion: 3 }]))
      .mockResolvedValueOnce(json({ ...item, memo: "my draft", memoVersion: 4 }));
    await render(true); draft("my draft"); await settle(() => button("저장").click());
    expect(host.querySelector<HTMLTextAreaElement>('textarea[aria-label="일정 메모"]')!.value).toBe("my draft");
    expect(transport).toHaveBeenCalledTimes(2);
    await settle(() => button("저장").click());
    expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain("remote body");
    await settle(() => button("확인").click());
    expect(JSON.parse(transport.mock.calls[2][1].body)).toEqual({ memo: "my draft", expectedMemoVersion: 3 });
  });
  it.each([403, 404])("retains the draft and blocks save/refetch after %s", async (status) => {
    transport.mockResolvedValue(json({ code: status === 403 ? "NOT_ROOM_MEMBER" : "SCHEDULE_ITEM_NOT_FOUND", message: "unavailable" }, status));
    await render(true); draft("retain me"); await settle(() => button("저장").click());
    expect(host.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("retain me");
    expect(button("저장").disabled).toBe(true);
    expect(transport).toHaveBeenCalledTimes(1);
    await settle(() => qc.setQueryData(key, []));
    expect(host.querySelector<HTMLTextAreaElement>('textarea[aria-label="보관된 메모 초안"]')!.value).toBe("retain me");
  });
  it.each([undefined, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("does not save with invalid version %s", async (memoVersion) => {
    qc.setQueryData(key, []); qc.setQueryData(key, [{ ...item, id: "item-1", title: "place", memoVersion }]);
    await render(true); draft("draft"); expect(button("저장").disabled).toBe(true); expect(transport).not.toHaveBeenCalled();
  });
});
