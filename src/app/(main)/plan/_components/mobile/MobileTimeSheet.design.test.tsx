// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("@/hooks/useRooms", () => ({ useUpdateScheduleItem: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
import { MobileTimeSheet } from "./MobileTimeSheet";
let root: Root;
let host: HTMLDivElement;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); host=document.createElement("div"); document.body.append(host); root=createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function open(startTime: string | null = null) {
 await act(async () => root.render(<MobileTimeSheet roomId="room" scheduleId={1} itemId={1} placeName="Place" startTime={startTime} endTime={null} onClose={() => {}} />));
}
it("has no unset choices in the wheel while the time fields stay unset", async () => {
 await open();
 for (const name of ["오전/오후","시","분"]) {
  const group=document.querySelector(`[aria-label="${name}"]`)!;
  expect(group).not.toBeNull(); expect(group.textContent).not.toContain("--");
 }
 expect(document.querySelector('[aria-label="시작 시간 미설정"]')).not.toBeNull();
});
it("starts in Enabled state with a visible disabled reset control", async () => {
 await open();
 const reset=[...document.querySelectorAll("button")].find(b => b.textContent?.trim()==="초기화");
 expect(reset).toBeDefined(); expect(reset?.disabled).toBe(true);
 expect(document.querySelector('[aria-label="시작 시간 미설정"]')?.getAttribute("aria-expanded")).toBe("false");
});
it.each([["00:05","오전 12:05"],["12:05","오후 12:05"]])("labels %s as %s without rewriting storage", async (start,display) => {
 await open(start);
 expect(document.querySelector('[aria-label^="시작 시간"]')?.textContent).toContain(display);
});
