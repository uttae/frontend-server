// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import { useVisiblePlacePhotoUrl } from "./useVisiblePlacePhotoUrl";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let markUnavailable: () => void = () => {};

function Probe({ url }: Readonly<{ url: string | null }>) {
  const photo = useVisiblePlacePhotoUrl(url);
  markUnavailable = photo.markUnavailable;
  return <span>{photo.visibleUrl ?? "사진 없음"}</span>;
}

it("못 불러온 주소는 숨기고, 주소가 바뀌면 다시 보인다", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(<Probe url="https://cdn.example/broken.jpg" />));
    expect(container.textContent).toBe("https://cdn.example/broken.jpg");

    await act(async () => markUnavailable());
    expect(container.textContent).toBe("사진 없음");

    await act(async () => root.render(<Probe url="https://cdn.example/fresh.jpg" />));
    expect(container.textContent).toBe("https://cdn.example/fresh.jpg");
  } finally {
    await act(async () => root.unmount());
  }
});
