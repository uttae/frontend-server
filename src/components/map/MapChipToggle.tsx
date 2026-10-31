import { Toggle } from "@base-ui/react/toggle";
import type { ReactNode } from "react";

import { Chip } from "@/components/ui/chip";

type Props = {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
};

/**
 * 지도 툴바에서 고르는 칩(카테고리·영업 중). Figma Chip Outline md(36px)이고, Base UI Toggle이라 선택 상태가 aria-pressed로 읽힌다.
 * 모바일에서는 보이는 크기는 두고 누르는 영역만 가상 요소로 44px까지 넓힌다. 배경이 보이는 칩이라 padding으로 넓히면 모양이 커진다
 */
export function MapChipToggle({ pressed, onPressedChange, children }: Readonly<Props>) {
  return (
    <Chip
      variant="outline"
      size="md"
      render={<Toggle pressed={pressed} onPressedChange={onPressedChange} />}
      className="relative [&_svg]:pointer-events-none mobile:before:absolute mobile:before:inset-x-0 mobile:before:top-1/2 mobile:before:h-11 mobile:before:-translate-y-1/2"
    >
      {children}
    </Chip>
  );
}
