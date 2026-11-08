import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Figma 15 Badges: Badge / Weak 5626:32, Badge / Solid 5626:58, Badge / Outline 5626:84. 비조작 라벨이라 hover·focus·transition이 없다
// 원시 변수로 쓰는 색: Figma primary/subtle(blue/50)은 코드 primary-subtle(blue-100)과 값이 다르고, status/*/subtle·strong은 코드에 토큰이 없다(코드 status-*는 */default).
// gray/800(Solid Neutral 배경)·green/800·orange/800(아이콘)은 Figma도 원시 변수에 바로 묶었다
const badgeVariants = cva(
  // radius/sm 4px은 맞는 토큰이 없다(rounded-sm = 6px)
  "inline-flex w-fit max-w-full shrink-0 items-center gap-1 overflow-hidden rounded-[4px] whitespace-nowrap",
  {
    variants: {
      variant: {
        weak: "",
        solid: "",
        // Figma도 Outline만 1px 테두리가 있어 폭이 2px 넓다. Weak·Solid에 투명 테두리를 두면 Figma보다 넓어진다
        outline: "border",
      },
      tone: {
        neutral: "",
        brand: "",
        informative: "",
        positive: "",
        warning: "",
        critical: "",
      },
      // 아이콘은 Figma lg 14·md 12px이고, 글자 크기 설정을 따라 커지지 않게 px로 둔다(원칙 3-2)
      size: {
        lg: "min-h-6 px-2 text-label-s-regular [&>svg]:size-[14px]",
        md: "min-h-5 px-1.5 text-label-xs-regular [&>svg]:size-[12px]",
      },
    },
    // Weak·Outline의 Positive·Warning은 Figma에서 아이콘만 문구보다 한 단계 진하다
    compoundVariants: [
      { variant: "weak", tone: "neutral", className: "bg-fill text-text" },
      { variant: "weak", tone: "brand", className: "bg-[var(--blue-50)] text-primary-strong" },
      { variant: "weak", tone: "informative", className: "bg-fill text-primary-strong" },
      { variant: "weak", tone: "positive", className: "bg-[var(--lime-100)] text-[var(--green-700)] [&>svg]:text-[var(--green-800)]" },
      { variant: "weak", tone: "warning", className: "bg-[var(--orange-100)] text-[var(--orange-700)] [&>svg]:text-[var(--orange-800)]" },
      { variant: "weak", tone: "critical", className: "bg-[var(--red-100)] text-[var(--red-800)]" },
      { variant: "solid", tone: "neutral", className: "bg-[var(--gray-800)] text-text-inverse" },
      { variant: "solid", tone: "brand", className: "bg-primary-strong text-text-inverse" },
      // Figma도 Weak / Informative와 같은 색이다(5626:38·50)
      { variant: "solid", tone: "informative", className: "bg-fill text-primary-strong" },
      { variant: "solid", tone: "positive", className: "bg-[var(--green-700)] text-text-inverse" },
      { variant: "solid", tone: "warning", className: "bg-[var(--orange-700)] text-text-inverse" },
      { variant: "solid", tone: "critical", className: "bg-[var(--red-800)] text-text-inverse" },
      { variant: "outline", tone: "neutral", className: "border-text text-text" },
      { variant: "outline", tone: "brand", className: "border-primary-strong text-primary-strong" },
      { variant: "outline", tone: "informative", className: "border-border text-primary-strong" },
      { variant: "outline", tone: "positive", className: "border-[var(--green-700)] text-[var(--green-700)] [&>svg]:text-[var(--green-800)]" },
      { variant: "outline", tone: "warning", className: "border-[var(--orange-700)] text-[var(--orange-700)] [&>svg]:text-[var(--orange-800)]" },
      { variant: "outline", tone: "critical", className: "border-[var(--red-800)] text-[var(--red-800)]" },
    ],
    defaultVariants: { variant: "weak", tone: "neutral", size: "lg" },
  },
);

/**
 * 아이콘(@/assets/icons)은 span으로 감싸지 않고 직계 자식으로 넣는다. 크기·색은 Badge의 [&>svg] 규칙이 정한다.
 * 긴 라벨은 부모 폭에서 잘리기만 한다(Figma에 말줄임 정의가 없다). 말줄임표가 필요한 곳은 호출부가 라벨을 `<span className="truncate">`로 감싼다.
 */
function Badge({
  className,
  variant = "weak",
  tone = "neutral",
  size = "lg",
  render,
  ...props
}: Readonly<useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">({ className: cn(badgeVariants({ variant, tone, size }), className) }, props),
    render,
    state: { slot: "badge", variant, tone, size },
  });
}

export { Badge };
