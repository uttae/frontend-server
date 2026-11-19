// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/api/errors";
import { trackAnalyticsEvent } from "@/lib/analytics/track";
import { bookmarkCategoriesQueryKey } from "@/lib/query-keys";
import { useSessionStore } from "@/stores/session-store";
import { AddToBookmarkModal } from "./AddToBookmarkModal";

vi.mock("@/lib/client-env", () => ({ clientEnv: { NEXT_PUBLIC_API_BASE_URL: "https://api.example.test", NEXT_PUBLIC_GOOGLE_CLIENT_ID: "test", NEXT_PUBLIC_GOOGLE_REDIRECT_URI: "https://example.test", NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "test" } }));
const api = vi.hoisted(() => ({ bookmarks: vi.fn() }));
vi.mock("@/lib/api/rooms", async (original) => ({ ...await original<object>(), createRoomBookmarks: api.bookmarks }));
vi.mock("@/lib/analytics/track", () => ({
  AnalyticsEvents: { addToBookmark: "add_to_bookmark", createBookmarkFolder: "create_bookmark_folder" },
  trackAnalyticsEvent: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type CreateBody = { googlePlaceId: string; categoryIds: number[] };

function serverWithPlaceIn(folders: Set<number>) {
  api.bookmarks.mockImplementation(async (roomId: string, { googlePlaceId, categoryIds }: CreateBody) =>
    categoryIds.filter((id) => !folders.has(id)).map((categoryId) => {
      folders.add(categoryId);
      return { bookmarkId: 100 + categoryId, roomId, googlePlaceId, categoryId, category: "", addedBy: null, createdAt: "2026-11-17" };
    }));
}

let client: QueryClient;
let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
const close = vi.fn();
beforeEach(async () => {
  vi.clearAllMocks();
  useSessionStore.setState({ currentRoomId: "room-a" });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(
    bookmarkCategoriesQueryKey("room-a"),
    [1, 2, 3].map((categoryId) => ({ categoryId, name: `폴더${categoryId}`, colorCode: "#EAB308", placeCount: 0 })),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(
    <QueryClientProvider client={client}><AddToBookmarkModal googlePlaceId="place" onClose={close} /></QueryClientProvider>,
  ));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); client.clear(); });

async function select(...folders: number[]) {
  for (const folder of folders) {
    await act(async () => document.querySelector<HTMLButtonElement>(`[aria-label="폴더${folder} 북마크에서 선택"]`)!.click());
  }
}
async function pressAdd() {
  const button = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === "추가");
  await act(async () => { button!.click(); await new Promise((resolve) => setTimeout(resolve, 10)); });
}

it("closes after adding the place to the selected folders that lacked it", async () => {
  const folders = new Set([1]);
  serverWithPlaceIn(folders);
  await select(1, 2, 3);
  await pressAdd();
  expect(api.bookmarks).toHaveBeenCalledExactlyOnceWith("room-a", { googlePlaceId: "place", categoryIds: [1, 2, 3] });
  expect([...folders].sort()).toEqual([1, 2, 3]);
  expect(toast.success).toHaveBeenCalledTimes(1);
  expect(toast.error).not.toHaveBeenCalled();
  expect(trackAnalyticsEvent).toHaveBeenCalledExactlyOnceWith("add_to_bookmark", expect.objectContaining({ room_id: "room-a" }));
  expect(close).toHaveBeenCalledTimes(1);
});

it("closes without an error when every selected folder already has the place", async () => {
  const folders = new Set([1, 2]);
  serverWithPlaceIn(folders);
  await select(1, 2);
  await pressAdd();
  expect([...folders].sort()).toEqual([1, 2]);
  expect(toast.error).not.toHaveBeenCalled();
  expect(trackAnalyticsEvent).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledTimes(1);
});

it("stays open on a conflicting concurrent add and completes when 추가 is pressed again", async () => {
  const folders = new Set([1]);
  api.bookmarks.mockImplementationOnce(async () => {
    folders.add(2);
    throw new HttpError(409, "이미 보관함에 추가된 장소입니다");
  });
  await select(1, 2, 3);
  await pressAdd();
  expect(toast.error).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();

  serverWithPlaceIn(folders);
  await pressAdd();
  expect([...folders].sort()).toEqual([1, 2, 3]);
  expect(close).toHaveBeenCalledTimes(1);
});
