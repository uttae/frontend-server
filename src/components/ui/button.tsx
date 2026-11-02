"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import { useId } from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

// Figma 01 Button: Button 5272:3019(Type × State) 안의 Button Base 5002:3814(Size)가 실제 모양을 그린다.
// 상태는 DOM으로 그린다: Hover=:hover, Pressed=:active, Disabled=data-disabled, Loading=aria-busy. Focus는 Figma에 변형이 없어(6055:562) 다른 ui 부품과 같은 outline이다.
// hover·active를 enabled:가 아니라 not-data-disabled:로 거는 이유: Loading은 focusableWhenDisabled라 native disabled가 아니어서 enabled:가 걸리고,
// render로 div를 그리면 :enabled가 아예 걸리지 않는다. Base UI는 두 경우 모두 data-disabled를 단다.
// Loading도 data-disabled라 비활성 색은 not-aria-busy:로 한정해 Loading 색과 겹치지 않게 한다. 비활성은 opacity 없이 Figma 색(6종 모두 fill/default + text/disabled, 5272:2989~3011)이다.
// 아이콘–문구 간격은 Figma Label 좌우 padding 6px뿐이라(6055:576) 문구 양옆 6px을 버튼 padding에 더하고, 아이콘 쪽은 data-icon으로 6px을 뺀 뒤 gap 6px로 둔다
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap select-none transition-colors duration-120 ease-out not-data-disabled:cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none data-disabled:not-aria-busy:bg-fill data-disabled:not-aria-busy:text-text-disabled [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        solid: "",
        weak: "",
        // Figma 테두리는 바깥 1px(strokeAlign OUTSIDE)이지만 높이 안에 둔다. 높이는 같고 폭만 Figma보다 2px 넓다
        outline: "border",
      },
      tone: {
        neutral: "",
        brand: "",
        critical: "",
      },
      // Button Base Size(5002:3815·3822·3829·3836). 높이는 시안 값을 min-h로 두고(원칙 3-2) 세로 padding은 따로 주지 않는다.
      // 가로 padding = Size padding + Label 6px. 아이콘은 크기·선 굵기 그대로 px다
      size: {
        // label/xl/emphasis 행간이 Figma 22·코드 토큰 24라 문구만 있으면 Figma 54px보다 2px 높다. 아이콘이 있을 때의 56px로 맞춘다.
        // radius/lg 12px은 코드 rounded-lg(10px)와 달라 임의값이다
        lg: "min-h-14 rounded-[12px] px-5.5 text-label-xl-emphasis has-data-[icon=inline-start]:ps-4 has-data-[icon=inline-end]:pe-4 [&_svg:not([class*='size-'])]:size-[24px]",
        md: "min-h-12 rounded-md px-5 text-label-l-emphasis has-data-[icon=inline-start]:ps-3.5 has-data-[icon=inline-end]:pe-3.5 [&_svg:not([class*='size-'])]:size-[20px]",
        sm: "min-h-9 rounded-md px-4 text-label-m-emphasis has-data-[icon=inline-start]:ps-2.5 has-data-[icon=inline-end]:pe-2.5 [&_svg:not([class*='size-'])]:size-[16px]",
        xs: "min-h-8 rounded-md px-3.5 text-label-m-emphasis has-data-[icon=inline-start]:ps-2 has-data-[icon=inline-end]:pe-2 [&_svg:not([class*='size-'])]:size-[16px]",
      },
    },
    // Figma 등록 Type 6종만 둔다(5864:9503 "Brand Weak·Critical Outline 등 미등록 조합을 자동 확장하지 않습니다"). 나머지 조합은 ButtonProps 타입이 막는다.
    // 원시 변수로 쓰는 색: gray/700·800·900, blue/950, red/900, gray/300은 Figma도 원시 변수에 바로 묶었고, status/negative/strong(red/800)은 코드에 시맨틱 토큰이 없다
    compoundVariants: [
      // Neutral Solid: Enabled 5272:3018, Hover 3010, Pressed 2999, Loading 2993
      {
        variant: "solid",
        tone: "neutral",
        className:
          "bg-[var(--gray-800)] text-text-inverse not-data-disabled:hover:bg-[var(--gray-700)] not-data-disabled:active:bg-[var(--gray-900)] aria-busy:bg-[var(--gray-700)]",
      },
      // Brand Solid: Enabled 5272:3001, Hover 2997, Pressed 3009, Loading 2994
      {
        variant: "solid",
        tone: "brand",
        className:
          "bg-primary text-text-inverse not-data-disabled:hover:bg-primary-strong not-data-disabled:active:bg-[var(--blue-950)] aria-busy:bg-primary-strong",
      },
      // Critical Solid: Enabled 5272:3016, Hover 3003, Pressed 3000, Loading 3017
      {
        variant: "solid",
        tone: "critical",
        className:
          "bg-status-negative text-text-inverse not-data-disabled:hover:bg-[var(--red-800)] not-data-disabled:active:bg-[var(--red-900)] aria-busy:bg-[var(--red-800)]",
      },
      // Neutral Weak: Enabled 5272:3015, Hover 3004, Pressed 3008, Loading 3006
      {
        variant: "weak",
        tone: "neutral",
        className:
          "bg-fill text-text not-data-disabled:hover:bg-fill-strong not-data-disabled:active:bg-[var(--gray-300)] aria-busy:bg-fill-strong",
      },
      // Outline 배경은 투명이 아니라 fill/subtle이다(5864:9503). 테두리는 Hover에서만 border/hover이고 Pressed·Loading·Disabled는 border/default다.
      // 마우스로 누르면 :hover도 함께 걸려서 Pressed 테두리를 다시 border/default로 둔다
      // Brand Outline: Enabled 5272:3013, Hover 3005, Pressed 2998, Loading 3012
      {
        variant: "outline",
        tone: "brand",
        className:
          "border-border bg-fill-subtle text-primary-strong not-data-disabled:hover:border-border-hover not-data-disabled:hover:bg-fill not-data-disabled:active:border-border not-data-disabled:active:bg-fill-strong aria-busy:bg-fill",
      },
      // Neutral Outline: Enabled 5272:3014, Hover 3002, Pressed 2996, Loading 2992
      {
        variant: "outline",
        tone: "neutral",
        className:
          "border-border bg-fill-subtle text-text not-data-disabled:hover:border-border-hover not-data-disabled:hover:bg-fill not-data-disabled:active:border-border not-data-disabled:active:bg-fill-strong aria-busy:bg-fill",
      },
    ],
    defaultVariants: { variant: "solid", tone: "neutral", size: "md" },
  },
);

/**
 * Figma 등록 Type 6종(5272:3019)만 받는다. 위계는 Solid(높음)·Weak(중간)·Outline(낮음)이고(5002:3793),
 * Brand는 핵심 행동, Neutral은 일반 행동, Critical은 파괴적 행동이다(5864:9503).
 * - solid: neutral(기본)·brand·critical
 * - weak: neutral
 * - outline: neutral·brand
 */
type ButtonTypeProps =
  | { variant?: "solid"; tone?: "neutral" | "brand" | "critical" }
  | { variant: "weak"; tone?: "neutral" }
  | { variant: "outline"; tone?: "neutral" | "brand" };

type ButtonProps = Omit<ButtonPrimitive.Props, "className"> &
  ButtonTypeProps & {
    /** 배치(폭·정렬·위치)에만 쓴다. 색·글자는 variant·tone·size로 고른다 */
    className?: string;
    /** Figma Size: lg 56 · md 48(기본, 대화상자 버튼) · sm 36(인라인 작은 버튼) · xs 32 */
    size?: "lg" | "md" | "sm" | "xs";
    /** true면 누를 수 없고(중복 실행 차단) 포커스는 남는다. 문구·아이콘은 자리만 남기고 가운데에 progress를 그린다 */
    loading?: boolean;
    /** loading 중 버튼의 접근성 이름. 화면에는 보이지 않는다(예: "저장 중") */
    loadingLabel?: string;
  };

/**
 * Base UI Button 위의 디자인 시스템 버튼. Base UI처럼 기본 type이 "button"이라 제출 버튼은 type="submit"을 적는다.
 * 문구 옆 아이콘(@/assets/icons)은 직계 자식으로 넣고 data-icon="inline-start"·"inline-end"를 단다. 크기는 Size가 정한다.
 * render는 링크가 아닌 요소(div 등)에만 쓰고 nativeButton={false}를 함께 준다. 이동은 Next Link를 쓴다(버튼 모양 링크는 이번 범위 밖).
 * 아이콘만 있는 버튼은 쓰지 않는다(Icon Only 크기·필수 접근성 이름이 아직 없다).
 * loading 중 접근성 이름은 loadingLabel이다. aria-labelledby를 loadingLabel span으로 바꾸므로 호출부 aria-label·aria-labelledby보다 우선하고, loading이 끝나면 호출부 값으로 돌아간다.
 *
 * @example
 * <DialogFooter>
 *   <DialogClose render={<Button variant="weak" className="flex-1" />}>취소</DialogClose>
 *   <Button type="submit" loading={isSaving} loadingLabel="저장 중" className="flex-1">확인</Button>
 * </DialogFooter>
 */
function Button({
  className,
  variant = "solid",
  tone = "neutral",
  size = "md",
  loading = false,
  loadingLabel = "처리 중",
  disabled,
  focusableWhenDisabled,
  children,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: Readonly<ButtonProps>) {
  const loadingLabelId = useId();

  return (
    <ButtonPrimitive
      data-slot="button"
      disabled={disabled || loading}
      // Base UI 권고(button.md "Loading states"): 누른 버튼에 포커스를 남긴다. native disabled 대신 aria-disabled와 클릭·Enter 차단이 걸린다
      focusableWhenDisabled={focusableWhenDisabled || loading}
      aria-busy={loading || undefined}
      // 같은 권고: 포커스된 버튼의 자손 문구 변화는 알리지 않는 브라우저·스크린리더 조합이 있어 aria-labelledby로 이름을 명시한다.
      // 이름 계산에서 aria-labelledby가 aria-label보다 먼저라 호출부 aria-label도 loading 중에는 쓰이지 않는다
      aria-labelledby={loading ? loadingLabelId : ariaLabelledBy}
      className={cn(buttonVariants({ variant, tone, size }), className)}
      {...props}
    >
      {/* Loading 전후로 너비·높이를 유지한다(5002:3811). 문구·아이콘은 늘 이 span 안에 두어 loading이 바뀌어도 다시 마운트되지 않는다 */}
      <span data-slot="button-content" className="contents group-aria-busy/button:invisible">
        {children}
      </span>
      {loading && (
        <>
          <span id={loadingLabelId} className="sr-only">
            {loadingLabel}
          </span>
          {/* 이름은 위 span이 맡아서 Spinner(output, 기본 aria-label "불러오는 중")는 접근성 트리에서 뺀다. 이름·status 알림이 겹치지 않게 한다.
              Figma Loading의 progress(252:30981)는 lg 24px만 있다. 나머지 크기는 20px. Solid는 icon/inverse, Weak·Outline은 icon/default */}
          <Spinner
            aria-hidden
            size={size === "lg" ? 24 : 20}
            variant={variant === "solid" ? "inverse" : "default"}
            className="absolute inset-0"
          />
        </>
      )}
    </ButtonPrimitive>
  );
}

export { Button };
