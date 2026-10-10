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

    const openButton = renderer.root.findByProps({ "aria-label": "1번째 장소 카페 경로 보기" });
    expect(openButton.type).toBe("button");
    act(() => openButton.props.onClick());
    expect(onOpen).toHaveBeenCalledOnce();

    const timeButton = renderer.root.findByProps({ "aria-label": "카페 방문 시간 수정" });
    act(() => timeButton.props.onClick({ stopPropagation: vi.fn() }));
    expect(onEditTime).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledOnce();

    act(() => renderer.unmount());
  });

  it("빈 시간·비용·메모는 켠 경우에만 추가 줄로 보여 주고 같은 동작을 부른다", () => {
    const onEditTime = vi.fn();
    const onOpenExpenses = vi.fn();
    const onEditMemo = vi.fn();
    const place = { id: "place-1", title: "카페" };
    const props = {
      orderNumber: 1,
      badgeColor: "#f12d33",
      expenseSummary: null,
      onOpenActions: vi.fn(),
      onOpenExpenses,
      onEditMemo,
      onEditTime,
      editing: false,
    };
    let renderer!: ReactTestRenderer;

    act(() => {
      renderer = create(<MobilePlanPlaceCard place={place} {...props} />);
    });
    expect(renderer.root.findAllByProps({ "aria-label": "카페 방문 시간 추가" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "aria-label": "카페 비용 추가" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "aria-label": "카페 메모 추가" })).toHaveLength(0);

    act(() => {
      renderer.update(
        <MobilePlanPlaceCard place={place} {...props} addWhenEmpty={{ time: true, expense: false, memo: false }} />,
      );
    });
    expect(renderer.root.findAllByProps({ "aria-label": "카페 메모 추가" })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ "aria-label": "카페 비용 추가" })).toHaveLength(0);
    act(() =>
      renderer.root.findByProps({ "aria-label": "카페 방문 시간 추가" }).props.onClick({ stopPropagation: vi.fn() }),
    );
    expect(onEditTime).toHaveBeenCalledOnce();

    act(() => {
      renderer.update(
        <MobilePlanPlaceCard place={place} {...props} addWhenEmpty={{ time: true, expense: true, memo: true }} />,
      );
    });
    act(() => renderer.root.findByProps({ "aria-label": "카페 비용 추가" }).props.onClick({ stopPropagation: vi.fn() }));
    expect(onOpenExpenses).toHaveBeenCalledOnce();
    act(() => renderer.root.findByProps({ "aria-label": "카페 메모 추가" }).props.onClick({ stopPropagation: vi.fn() }));
    expect(onEditMemo).toHaveBeenCalledOnce();

    act(() => renderer.unmount());
  });
});
