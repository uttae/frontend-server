// @vitest-environment jsdom
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { hookHarness } from "@/test/hook-harness";
import { usePlacesSearch } from "./usePlacesSearch";
const { searchPlaces } = vi.hoisted(() => ({ searchPlaces: vi.fn() }));
vi.mock("@/lib/api/places", () => ({ searchPlaces }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const h = () =>
  hookHarness(
    (p: Parameters<typeof usePlacesSearch>) => usePlacesSearch(...p),
    (child) => (
      <QueryClientProvider client={client}>{child}</QueryClientProvider>
    ),
  );
const page = (name: string, nextPageToken: string | null = null) => ({
  items: [{ googlePlaceId: name, name, location: { lat: 1, lng: 2 } }],
  nextPageToken,
});
beforeEach(() => {
  searchPlaces.mockReset();
  client.clear();
});
afterEach(() => client.clear());
it("paginates both ways and resets every search condition to token-free page one", async () => {
  searchPlaces.mockImplementation(async ({ pageToken }) =>
    page(pageToken ?? "first", pageToken ? null : "next"),
  );
  const hook = h();
  let args: Parameters<typeof usePlacesSearch> = ["cafe", 1, 2, 1000, 10, 1];
  await hook.render(args);
  await hook.flush();
  for (const change of [
    { 0: "food" },
    { 1: 3 },
    { 2: 4 },
    { 3: 2000 },
    { 4: 5 },
    { 5: 2 },
  ]) {
    await act(async () => hook.current.goToNextPage());
    await hook.flush();
    expect(hook.current.pageIndex).toBe(1);
    expect(hook.current.items[0].name).toBe("next");
    await act(async () => hook.current.goToPreviousPage());
    await hook.flush();
    expect(hook.current.items[0].name).toBe("first");
    await act(async () => hook.current.goToNextPage());
    await hook.flush();
    args = [
      change[0] ?? args[0],
      change[1] ?? args[1],
      change[2] ?? args[2],
      change[3] ?? args[3],
      change[4] ?? args[4],
      change[5] ?? args[5],
    ];
    await hook.render(args);
    await hook.flush();
    expect(hook.current.pageIndex).toBe(0);
    expect(hook.current.items[0].name).toBe("first");
    expect(searchPlaces.mock.lastCall?.[0].pageToken).toBeUndefined();
  }
  await hook.unmount();
});
it("does not reuse an in-flight previous generation or its next-page token", async () => {
  let finishOld!: (value: ReturnType<typeof page>) => void;
  searchPlaces
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    )
    .mockResolvedValueOnce(page("fresh", "fresh-next"));
  const hook = h();
  await hook.render(["cafe", 1, 2, 1000, 10, 1]);
  await hook.render(["cafe", 1, 2, 1000, 10, 2]);
  await hook.flush();
  await act(async () => finishOld(page("stale", "stale-next")));
  await hook.flush();
  expect(searchPlaces).toHaveBeenCalledTimes(2);
  expect(hook.current.items[0].name).toBe("fresh");
  searchPlaces.mockResolvedValueOnce(page("fresh-second"));
  await act(async () => hook.current.goToNextPage());
  await hook.flush();
  expect(searchPlaces.mock.lastCall?.[0].pageToken).toBe("fresh-next");
  await hook.unmount();
});
