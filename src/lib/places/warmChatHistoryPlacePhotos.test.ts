import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestPlacePhotoUrl = vi.fn();
const requestPlacePhotoUrlsBatch = vi.fn();

vi.mock("@/lib/api/places", () => ({
  requestPlacePhotoUrl,
  requestPlacePhotoUrlsBatch,
}));

describe("warmPlacePhotoQueriesFromChatHistory", () => {
  beforeEach(() => {
    requestPlacePhotoUrl.mockReset();
    requestPlacePhotoUrlsBatch.mockReset();
  });

  it("does not warm photo URLs before place cards enter the viewport", async () => {
    const { warmPlacePhotoQueriesFromChatHistory } = await import(
      "@/lib/places/warmChatHistoryPlacePhotos"
    );
    const queryClient = new QueryClient();

    await warmPlacePhotoQueriesFromChatHistory(queryClient, [
      {
        id: "share-1",
        roomId: "room-1",
        senderId: 1,
        messageType: "PLACE_SHARE",
        createdAt: "2026-07-28T00:00:00.000Z",
        metadata: {
          googlePlaceId: "ChIJ-share",
          name: "Shared place",
          latitude: "37.5",
          longitude: "127.0",
          photoName: "places/old-share/photos/dead-token",
        },
      },
      {
        id: "ai-1",
        roomId: "room-1",
        senderId: 2,
        messageType: "AI_RESPONSE",
        createdAt: "2026-07-28T00:01:00.000Z",
        metadata: {
          intent: "place_recommendation",
          place_recommendation: JSON.stringify({
            places: [
              {
                placeId: "ChIJ-ai",
                name: "AI place",
                address: "서울",
                lat: 37.51,
                lng: 127.01,
                photoName: "places/old-ai/photos/dead-token",
              },
            ],
          }),
        },
      },
    ]);

    expect(requestPlacePhotoUrl).not.toHaveBeenCalled();
    expect(requestPlacePhotoUrlsBatch).not.toHaveBeenCalled();
  });
});
