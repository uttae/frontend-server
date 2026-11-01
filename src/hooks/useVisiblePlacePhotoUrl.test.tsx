// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { useVisiblePlacePhotoUrl } from "./useVisiblePlacePhotoUrl";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** 버튼을 누르면 사진을 불러오지 못한 것으로 표시한다 */
function Probe({ url }: Readonly<{ url: string | null }>) {
  const photo = useVisiblePlacePhotoUrl(url);
  return (
    <button type="button" onClick={photo.markUnavailable}>
      {photo.visibleUrl ?? "사진 없음"}
    </button>
  );
}

it("못 불러온 주소는 숨기고, 주소가 바뀌면 다시 보인다", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<Probe url="https://cdn.example/broken.jpg" />));
    expect(container.textContent).toBe("https://cdn.example/broken.jpg");

    await act(async () => container.querySelector("button")?.click());
    expect(container.textContent).toBe("사진 없음");

    await act(async () => root.render(<Probe url="https://cdn.example/fresh.jpg" />));
    expect(container.textContent).toBe("https://cdn.example/fresh.jpg");
  } finally {
    await act(async () => root.unmount());
  }
});
