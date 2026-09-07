"use client";

import { MapPinIcon } from "@/components/icons";

import {
  MAP_PIN_DISPLAY_SIZE_PX,
  mapPinBodyBorderProps,
} from "./map-pin-stroke";

/** 검색 페이지(`MapSearchResultPins`) 디스커버 핀이 공통으로 쓰는 핀·이름 레이블 UI */
export function MapPinWithPlaceName({ name }: { name: string }) {
  return (
    <div className="flex cursor-pointer flex-col items-center">
      <span className="block drop-shadow-md text-primary">
        <MapPinIcon
          size={MAP_PIN_DISPLAY_SIZE_PX}
          {...mapPinBodyBorderProps}
        />
      </span>
      <div
        className="mt-0.5 max-w-[min(10rem,calc(100vw-2rem))] truncate rounded-md bg-black/72 px-1.5 py-0.5 text-center text-[13px] font-semibold leading-tight tracking-tight text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
        title={name}
      >
        {name}
      </div>
    </div>
  );
}
