import { beforeEach, describe, expect, it, vi } from "vitest";

const requestPlacePreview = vi.fn();
const requestPlacePreviewsBatch = vi.fn();

vi.mock("@/lib/api/places", () => ({
  requestPlaceDetail: vi.fn(),
  requestPlacePreview,
  requestPlacePreviewsBatch,
}));

const previewItem = (googlePlaceId: string) => ({
  googlePlaceId,
  name: `이름 ${googlePlaceId}`,
  formattedAddress: "서울",
  location: { latitude: 37.5, longitude: 127.0 },
  primaryType: "cafe",
  primaryTypeDisplayName: "카페",
});
const failed = (googlePlaceId: string) => ({
  status: "FAILED",
  googlePlaceId,
  errorCode: "EXTERNAL_API_ERROR",
});

/** 같은 커밋에 미리보기 쿼리 여러 개가 마운트된 것처럼 한 태스크 안에서 queryFn을 부른다 */
async function loadPreviews(ids: string[]) {
  const { placePreviewQueryOptions } = await import("@/lib/places/place-queries");
  return Promise.allSettled(ids.map((id) => placePreviewQueryOptions(id).queryFn()));
}

describe("placePreviewQueryOptions", () => {
  beforeEach(() => {
    requestPlacePreview.mockReset();
    requestPlacePreviewsBatch.mockReset();
  });

  it("같은 커밋의 미리보기 쿼리는 batch 하나로 받고, 응답 id 형식이 달라도 같은 장소로 맞춘다", async () => {
    requestPlacePreviewsBatch.mockResolvedValueOnce([
      { status: "OK", ...previewItem("places/ChIJ-a") },
      { status: "OK", ...previewItem("ChIJ-b") },
    ]);

    const [a, b] = await loadPreviews(["ChIJ-a", "ChIJ-b"]);

    expect(requestPlacePreviewsBatch).toHaveBeenCalledExactlyOnceWith(["ChIJ-a", "ChIJ-b"]);
    expect(a).toMatchObject({
      status: "fulfilled",
      value: { name: "이름 places/ChIJ-a", location: { lat: 37.5, lng: 127.0 } },
    });
    expect(b).toMatchObject({ status: "fulfilled", value: { name: "이름 ChIJ-b" } });
    expect(requestPlacePreview).not.toHaveBeenCalled();
  });

  it("status 없이 온 항목도 id와 이름이 있으면 받는다", async () => {
    requestPlacePreviewsBatch.mockResolvedValueOnce([previewItem("ChIJ-a"), previewItem("ChIJ-b")]);

    const [a, b] = await loadPreviews(["ChIJ-a", "ChIJ-b"]);

    expect(a).toMatchObject({ status: "fulfilled", value: { name: "이름 ChIJ-a" } });
    expect(b).toMatchObject({ status: "fulfilled", value: { name: "이름 ChIJ-b" } });
    expect(requestPlacePreviewsBatch).toHaveBeenCalledTimes(1);
    expect(requestPlacePreview).not.toHaveBeenCalled();
  });

  it("FAILED 항목은 실패한 곳만 batch로 한 번 더 받고, 그래도 실패하면 502로 끝낸다", async () => {
    const { HttpError } = await import("@/lib/api/errors");
    requestPlacePreviewsBatch
      .mockResolvedValueOnce([
        { status: "OK", ...previewItem("ChIJ-ok") },
        failed("ChIJ-retried"),
        failed("ChIJ-failed"),
      ])
      .mockResolvedValueOnce([{ status: "OK", ...previewItem("ChIJ-retried") }, failed("ChIJ-failed")]);

    const [ok, retried, stillFailed] = await loadPreviews(["ChIJ-ok", "ChIJ-retried", "ChIJ-failed"]);

    expect(requestPlacePreviewsBatch.mock.calls).toEqual([
      [["ChIJ-ok", "ChIJ-retried", "ChIJ-failed"]],
      [["ChIJ-retried", "ChIJ-failed"]],
    ]);
    expect(ok.status).toBe("fulfilled");
    expect(retried.status).toBe("fulfilled");
    expect(stillFailed.status).toBe("rejected");
    if (stillFailed.status === "rejected") {
      expect(stillFailed.reason).toBeInstanceOf(HttpError);
      expect(stillFailed.reason).toMatchObject({ status: 502 });
    }
    expect(requestPlacePreview).not.toHaveBeenCalled();
  });

  it("미리보기 1곳은 단건 API로 받는다", async () => {
    requestPlacePreview.mockResolvedValueOnce(previewItem("ChIJ-single"));

    const [single] = await loadPreviews(["places/ChIJ-single"]);

    expect(single).toMatchObject({ status: "fulfilled", value: { googlePlaceId: "ChIJ-single" } });
    expect(requestPlacePreview).toHaveBeenCalledExactlyOnceWith("ChIJ-single");
    expect(requestPlacePreviewsBatch).not.toHaveBeenCalled();
  });
});
