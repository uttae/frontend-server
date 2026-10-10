import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AddMemberPanel } from "./AddMemberPanel";

const commands = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/client", () => ({ sendAnalyticsDataCommand: commands }));
vi.mock("@/hooks/useRooms", () => ({ useRegenerateInviteCode: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn() } }));
let renderer: ReactTestRenderer;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("window", { location: { origin: "https://example.test", pathname: "/member-settings" } });
});
afterEach(async () => { await act(async () => renderer?.unmount()); vi.unstubAllGlobals(); vi.clearAllMocks(); });
async function mount() {
  await act(async () => { renderer = create(<AddMemberPanel roomId="room-42" inviteCode="private-access-code" memberCount={2} role="HOST" isRoomDetailLoading={false} isRoomDetailError={false} onClose={() => {}} />); });
}
it.each(["copy_link", "native_share"])("records the existing room only after %s succeeds", async (method) => {
  let resolve!: () => void;
  const pending = new Promise<void>(done => { resolve = done; });
  vi.stubGlobal("navigator", { clipboard: { writeText: () => pending }, share: () => pending });
  await mount();
  const button = renderer.root.findAllByType("button").find(b => b.children.includes(method === "copy_link" ? "복사" : "친구에게 공유"))!;
  await act(async () => { void button.props.onClick(); });
  expect(commands).not.toHaveBeenCalled();
  await act(async () => { resolve(); await pending; });
  expect(commands).toHaveBeenCalledExactlyOnceWith("event", "share", {
    room_id: "room-42", role: "host", member_count_bucket: "2", method,
    page_path: "/member-settings", page_location: "https://example.test/member-settings",
  });
  expect(JSON.stringify(commands.mock.calls)).not.toContain("private-access-code");
});
it("does not record a rejected copy or cancelled native share", async () => {
  vi.stubGlobal("navigator", {
    clipboard: { writeText: async () => { throw new Error("clipboard denied"); } },
    share: async () => { throw Object.assign(new Error("cancelled"), { name: "AbortError" }); },
  });
  await mount();
  for (const label of ["복사", "친구에게 공유"]) {
    const button = renderer.root.findAllByType("button").find(b => b.children.includes(label))!;
    await act(async () => { await button.props.onClick(); });
  }
  expect(commands).not.toHaveBeenCalled();
});
