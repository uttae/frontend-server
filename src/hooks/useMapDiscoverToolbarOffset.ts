"use client";

import {
  useCallback,
  useEffect,
  useState,
  type RefCallback,
} from "react";

import {
  MAP_DETAIL_PANEL_BELOW_TOOLBAR_GAP_PX,
  MAP_DETAIL_PANEL_MIN_TOP_PX,
} from "@/lib/layout/mapDetailPanelLayout";

/**
 * Map 섹션 상단 ~ 툴바 하단 + gap → PlaceDetailPanel `top`(px).
 * 필터 한 줄 아래가 최솟값이라, 툴바를 숨기면(`hidden`, 높이 0) 그 자리로 돌아온다
 */
export function useMapDiscoverToolbarOffset(mapSectionEl: HTMLElement | null): {
  setToolbarRef: RefCallback<HTMLElement>;
  panelTopPx: number;
} {
  const [toolbarEl, setToolbarEl] = useState<HTMLElement | null>(null);
  const [panelTopPx, setPanelTopPx] = useState(MAP_DETAIL_PANEL_MIN_TOP_PX);

  const setToolbarRef: RefCallback<HTMLElement> = useCallback((el) => {
    setToolbarEl(el);
  }, []);

  useEffect(() => {
    if (!mapSectionEl || !toolbarEl || typeof ResizeObserver === "undefined") {
      return;
    }

    const update = () => {
      const mapTop = mapSectionEl.getBoundingClientRect().top;
      const toolbarBottom = toolbarEl.getBoundingClientRect().bottom;
      setPanelTopPx(
        Math.max(
          MAP_DETAIL_PANEL_MIN_TOP_PX,
          Math.ceil(toolbarBottom - mapTop + MAP_DETAIL_PANEL_BELOW_TOOLBAR_GAP_PX),
        ),
      );
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(mapSectionEl);
    ro.observe(toolbarEl);
    return () => ro.disconnect();
  }, [mapSectionEl, toolbarEl]);

  return { setToolbarRef, panelTopPx };
}
