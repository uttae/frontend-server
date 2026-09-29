import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { MobilePlanPlaceCard } from "./MobilePlanPlaceCard";

describe("MobilePlanPlaceCard", () => {
  it("장소 열기를 네이티브 버튼으로 제공하고 편집 동작과 분리한다", () => {
    const onOpen = vi.fn();
    const onEditTime = vi.fn();
    let renderer!: ReactTestRenderer;

    act(() => {
      renderer = create(
        <MobilePlanPlaceCard
          place={{ id: "place-1", title: "카페", startTime: "09:00" }}
          orderNumber={1}
          badgeColor="#f12d33"
          expenseSummary={null}
          onOpen={onOpen}
          onOpenActions={vi.fn()}
          onOpenExpenses={vi.fn()}
          onEditMemo={vi.fn()}
          onEditTime={onEditTime}
          editing={false}
        />,
      );
    });

    const openButton = renderer.root.findByProps({ "aria-label": "1번째 장소 카페 지도에서 보기" });
    expect(openButton.type).toBe("button");
    act(() => openButton.props.onClick());
    expect(onOpen).toHaveBeenCalledOnce();

    const timeButton = renderer.root.findByProps({ "aria-label": "카페 방문 시간 수정" });
    act(() => timeButton.props.onClick({ stopPropagation: vi.fn() }));
    expect(onEditTime).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledOnce();

    act(() => renderer.unmount());
  });
});
