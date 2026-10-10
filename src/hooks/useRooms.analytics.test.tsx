// @vitest-environment jsdom
import { useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useRegenerateInviteCode, useUpdateRoom } from "./useRooms";
import { analyticsConsentStore } from "@/lib/analytics/consent-store";
import { initializeAmplitude } from "@/lib/analytics/amplitude";
import { initializeGoogleAnalytics } from "@/lib/analytics/client";
import { roomDetailQueryKey, roomMembersQueryKey, sessionUserQueryKey } from "@/lib/query-keys";
import { useSessionStore } from "@/stores/session-store";

const calls = vi.hoisted(() => ({
  issue: vi.fn(), update: vi.fn(), hydrate: vi.fn(),
  track: vi.fn(), initAll: vi.fn(async () => {}), setUserId: vi.fn(), setOptOut: vi.fn(), reset: vi.fn(),
}));
vi.mock("@/lib/api/rooms", async (original) => ({
  ...await original<object>(), regenerateInviteCode: calls.issue, updateRoom: calls.update,
}));
vi.mock("@/lib/rooms", async (original) => ({
  ...await original<object>(), hydrateRoomSchedulesFromServer: calls.hydrate,
}));
vi.mock("@amplitude/unified", () => ({
  track: calls.track, initAll: calls.initAll, setUserId: calls.setUserId, setOptOut: calls.setOptOut, reset: calls.reset,
}));
vi.mock("@/lib/analytics/amplitude-runtime", () => ({ amplitudeRuntime: { enabled: true, apiKey: "test", sessionReplaySampleRate: 0 } }));
vi.mock("@/lib/analytics/runtime", () => ({ analyticsRuntime: { enabled: true } }));

let client: QueryClient;
let renderer: ReactTestRenderer;
let issue: ReturnType<typeof useRegenerateInviteCode>;
let update: ReturnType<typeof useUpdateRoom>;
const detail = { id: "target-room", role: "MEMBER", inviteCode: "private-code", title: "private-title", destinations: ["private-place"], memberCount: 2, startDate: "2026-10-10", endDate: "2026-10-12", createdAt: "2026-10-10" };
const variables = { roomId: detail.id, data: { title: "changed-private-title" } };
const issueArgs = (trigger: "explicit" | "automatic" = "explicit") => ({ roomId: detail.id, trigger });
function Harness() {
  const issuance = useRegenerateInviteCode();
  const patch = useUpdateRoom();
  useEffect(() => { issue = issuance; update = patch; }, [issuance, patch]);
  return null;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const events = () => calls.track.mock.calls.map(([value]) => value);
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(sessionUserQueryKey, { id: 17 });
  client.setQueryData(roomDetailQueryKey(detail.id), detail);
  useSessionStore.setState({ sessionReady: true, currentRoomId: detail.id });
  analyticsConsentStore.set("granted");
  initializeAmplitude(); initializeGoogleAnalytics("G-TEST", false);
  await Promise.resolve(); await Promise.resolve();
  calls.issue.mockResolvedValue({ inviteCode: "new-private-code" });
  calls.update.mockResolvedValue({ ...detail, title: "changed-private-title" });
  calls.hydrate.mockResolvedValue([]);
  await act(async () => { renderer = create(<QueryClientProvider client={client}><Harness /></QueryClientProvider>); });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  client.clear(); vi.unstubAllGlobals();
});

it.each(["HOST", "MEMBER"])("records explicit %s issuance only after the API succeeds, with room group and no secret fields", async role => {
  client.setQueryData(roomDetailQueryKey(detail.id), { ...detail, role });
  const pending = deferred<{ inviteCode: string }>(); calls.issue.mockReturnValue(pending.promise);
  let result!: Promise<unknown>;
  await act(async () => { result = issue.mutateAsync(issueArgs()); });
  expect(events()).toEqual([]);
  await act(async () => { pending.resolve({ inviteCode: "new-private-code" }); await result; });
  expect(events()).toEqual([{ event_type: "invite_code_issued", event_properties: { room_id: detail.id, role: role.toLowerCase(), page_path: "/", page_location: window.location.origin + "/" }, groups: { room_id: detail.id } }]);
  expect(JSON.stringify(events())).not.toMatch(/private-code|private-title|private-place/);
  expect((window.dataLayer ?? []).map(x => Array.from(x as ArrayLike<unknown>)).filter(x => x[0] === "event")).not.toContainEqual(expect.arrayContaining(["invite_code_issued"]));
});
it("does not count automatic fallback or failed issuance", async () => {
  await act(async () => { await issue.mutateAsync(issueArgs("automatic")); });
  calls.issue.mockRejectedValue(new Error("forbidden"));
  await act(async () => { await expect(issue.mutateAsync(issueArgs())).rejects.toThrow("forbidden"); });
  expect(events()).toEqual([]);
});
it("uses the actual PATCH response role and counts success before a failing follow-up refresh", async () => {
  client.setQueryData(roomDetailQueryKey(detail.id), { ...detail, role: "HOST" });
  calls.hydrate.mockRejectedValue(new Error("refresh failed"));
  await act(async () => { await expect(update.mutateAsync({ ...variables, data: { endDate: "2026-10-13" } })).rejects.toThrow("refresh failed"); });
  expect(events()).toEqual([{ event_type: "room_info_updated", event_properties: { room_id: detail.id, role: "member", page_path: "/", page_location: window.location.origin + "/" }, groups: { room_id: detail.id } }]);
});
it("does not record PATCH failures", async () => {
  calls.update.mockRejectedValue(new Error("invalid dates"));
  await act(async () => { await expect(update.mutateAsync(variables)).rejects.toThrow("invalid dates"); });
  expect(events()).toEqual([]);
});
it.each(["issue", "update"])("does not backfill %s started without consent", async kind => {
  analyticsConsentStore.set("denied");
  const pending = deferred<typeof detail>();
  (kind === "issue" ? calls.issue : calls.update).mockReturnValue(pending.promise);
  let result!: Promise<unknown>;
  await act(async () => { result = kind === "issue" ? issue.mutateAsync(issueArgs()) : update.mutateAsync(variables); });
  analyticsConsentStore.set("granted");
  await act(async () => { pending.resolve(detail); await result; });
  expect(events()).toEqual([]);
});
it.each(["account", "logout", "room", "permission", "consent"])("drops pending success permanently after %s roundtrip", async change => {
  const pending = deferred<typeof detail>(); calls.update.mockReturnValue(pending.promise);
  let result!: Promise<unknown>;
  await act(async () => { result = update.mutateAsync(variables); });
  if (change === "account") { client.setQueryData(sessionUserQueryKey, { id: 99 }); client.setQueryData(sessionUserQueryKey, { id: 17 }); }
  if (change === "logout") { useSessionStore.setState({ sessionReady: false }); useSessionStore.setState({ sessionReady: true }); }
  if (change === "room") { useSessionStore.setState({ currentRoomId: "other" }); useSessionStore.setState({ currentRoomId: detail.id }); }
  if (change === "permission") { client.removeQueries({ queryKey: roomDetailQueryKey(detail.id) }); client.setQueryData(roomDetailQueryKey(detail.id), detail); }
  if (change === "consent") { analyticsConsentStore.set("denied"); analyticsConsentStore.set("granted"); }
  await act(async () => { pending.resolve(detail); await result; });
  expect(events()).toEqual([]);
});
it("uses the requested home-card room instead of injecting the selected room", async () => {
  useSessionStore.setState({ currentRoomId: "another-selected-room" });
  await act(async () => { await issue.mutateAsync(issueArgs()); });
  expect(events()[0]).toMatchObject({ event_type: "invite_code_issued", groups: { room_id: detail.id } });
});

it.each(["PENDING", "LEFT", undefined])("does not attribute issuance to invalid role %s", async role => {
  client.setQueryData(roomDetailQueryKey(detail.id), { ...detail, role });
  await act(async () => { await issue.mutateAsync(issueArgs()); });
  expect(events()).toEqual([]);
});
it("does not attribute to a logged-out session even if a stale request succeeds", async () => {
  useSessionStore.setState({ sessionReady: false });
  await act(async () => { await update.mutateAsync(variables); });
  expect(events()).toEqual([]);
});
it("drops issuance when a known membership becomes LEFT while the request is pending", async () => {
  const pending = deferred<{ inviteCode: string }>(); calls.issue.mockReturnValue(pending.promise);
  let result!: Promise<unknown>;
  await act(async () => { result = issue.mutateAsync(issueArgs()); });
  client.setQueryData(roomMembersQueryKey(detail.id), { members: [{ userId: 17, role: "MEMBER", status: "LEFT" }] });
  await act(async () => { pending.resolve({ inviteCode: "new-private-code" }); await result; });
  expect(events()).toEqual([]);
});
