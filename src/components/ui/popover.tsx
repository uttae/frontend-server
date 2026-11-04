"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * 트리거에 붙어 뜨는 패널. 동작 목록이면 DropdownMenu, 값 하나를 고르면 Select를 쓴다.
 * modal 기본값은 Base UI 기본 false다. 지금 패널들처럼 바깥 클릭이 뒤로 전달되고 페이지 스크롤을 막지 않는다.
 * 바깥 클릭·Esc로 닫히고, 열면 첫 포커스 가능 요소로(터치면 패널로), 닫으면 트리거로 포커스가 돌아간다.
 */
function Popover(props: Readonly<PopoverPrimitive.Root.Props>) {
  return <PopoverPrimitive.Root {...props} />;
}

/** 기본은 `<button type="button">`이다. 아바타 묶음처럼 모양이 있는 버튼은 className으로 그리고, 다른 요소는 render로 넘긴다 */
function PopoverTrigger(props: Readonly<PopoverPrimitive.Trigger.Props>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

// Figma DS에 일반 팝오버 컴포넌트가 없어 표면은 Modal(5956:24724)의 fill/elevation·radius 12·shadow/default(0 2 10 #1f2229 10%)를 쓴다.
// 안쪽 여백·간격·폭은 Figma 근거가 없어 지금 화면 값을 variant로 옮긴다.
// 열림·닫힘 전환은 Figma에 없어 Select 목록과 같은 Base UI 문서 예시(scale 0.98·opacity, 100ms)를 쓴다.
// data-instant(키보드로 열기·Esc·포커스 이탈로 닫힘)에는 전환하지 않는다(Select 팝업에는 이 속성이 없다)
const popoverContentVariants = cva(
  "flex origin-(--transform-origin) flex-col outline-hidden transition-[opacity,scale] duration-100 ease-out data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-instant:transition-none motion-reduce:transition-none",
  {
    variants: {
      variant: {
        // 지금 헤더 구성원 미리보기(HeaderMemberPreview) 값: 폭 305·padding 24·gap 16. 띄운 패널이라 화면 폭으로 상한을 건다(원칙 3-2)
        panel:
          "w-[min(305px,calc(100vw-2rem))] gap-4 rounded-[12px] bg-fill-elevate p-6 text-text shadow-[0_2px_10px_rgba(31,34,41,0.10)]",
        // 내용이 자기 표면을 그릴 때(기간 칸 아래 달력 = DatePicker 카드). 표면 없이 기준 요소 폭에 맞춘다(지금 달력의 inset-x-0)
        bare: "w-(--anchor-width)",
      },
    },
    defaultVariants: { variant: "panel" },
  },
);

// Base UI는 상태 함수 className도 받지만 cn이 버리므로 배치용 문자열만 받는다
type PopoverContentProps = Omit<PopoverPrimitive.Popup.Props, "className"> &
  Pick<PopoverPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset" | "anchor"> &
  VariantProps<typeof popoverContentVariants> & { className?: string };

/**
 * 포털·위치·표면을 한 번에 그린다. 접근성 이름은 `aria-label`로 준다(패널 role은 dialog).
 * - variant: `panel`(기본, 표면 있음) / `bare`(표면 없음, 기준 요소 폭)
 * - side·align: Base UI 기본 bottom·center. 오른쪽 끝 맞춤은 `align="end"`
 * - sideOffset: 기본 8(지금 헤더 미리보기 mt-2). 기간 달력은 12(Figma Date Picker 열림 배치 5956:15759 gap 12)
 * - anchor: 트리거가 아닌 요소에 붙일 때(기간 칸 두 개를 감싼 묶음)
 * - initialFocus·finalFocus: Base UI Popup 그대로. 열 때 포커스를 옮기지 않으려면 `initialFocus={false}`
 * - className: 배치(폭 등)만. 색·여백은 variant로 바꾼다
 */
function PopoverContent({
  className,
  variant,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 8,
  anchor,
  ...props
}: Readonly<PopoverContentProps>) {
  return (
    <PopoverPrimitive.Portal>
      {/* 다른 body 포털 부품(대화상자·Select 등)과 같은 z-50이라 나중에 연 이 패널이 위에 뜬다. 앱 내용은 isolate로 감싸 있어(app-chrome-shell) 앱 안 z와 겨루지 않는다 */}
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        anchor={anchor}
        className="z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(popoverContentVariants({ variant }), className)}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverContent, PopoverTrigger };
