import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { scheduleItemsQueryKey } from "@/lib/query-keys";
import { ExpensePlaceLabel } from "./ExpensePlaceLabel";

vi.mock("@/hooks/useRooms", () => ({ useSchedulePlanPlaces: () => { throw new Error("Must not use the fetching hook"); } }));
let renderer: ReactTestRenderer;
let client: QueryClient;
const request = vi.fn(async () => []);
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  request.mockClear();
  client = new QueryClient({ defaultOptions: { queries: { queryFn: request, retry: false } } });
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  client.clear();
  vi.unstubAllGlobals();
});
async function mount() {
  await act(async () => {
    renderer = create(<QueryClientProvider client={client}><ExpensePlaceLabel roomId="r" scheduleId={2} itemId={26} /></QueryClientProvider>);
  });
}
it("uses cached names and reacts to cache updates without fetching", async () => {
  const key = scheduleItemsQueryKey("r", 2);
  await mount();
  expect(JSON.stringify(renderer.toJSON())).toContain("확인되지 않음");
  await act(async () => { client.setQueryData(key, [{ itemId: 26, title: "도쿄 타워" }]); });
  expect(JSON.stringify(renderer.toJSON())).toContain("도쿄 타워");
  await act(async () => { await client.invalidateQueries({ queryKey: key }); });
  expect(request).not.toHaveBeenCalled();
  await act(async () => { client.removeQueries({ queryKey: key }); });
  expect(JSON.stringify(renderer.toJSON())).toContain("확인되지 않음");
  expect(request).not.toHaveBeenCalled();
});
it.each(["", "   ", "장소 정보를 불러올 수 없음"])("shows the fallback for an unresolved cached title: %s", async title => {
  client.setQueryData(scheduleItemsQueryKey("r", 2), [{ itemId: 26, title }]);
  await mount();
  expect(JSON.stringify(renderer.toJSON())).toContain("확인되지 않음");
  expect(JSON.stringify(renderer.toJSON())).not.toContain("#26");
  expect(request).not.toHaveBeenCalled();
});
