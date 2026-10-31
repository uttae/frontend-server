import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { CloseIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

// Figma 14 Chips: Chip / Solid 5625:359, Chip / Outline 5625:475
// Selected는 aria-pressed:, State=Pressed는 :active, Disabled는 data-disabled:로 그린다. Base UI의 data-pressed는 Selected라 눌림에 쓰지 않는다.
// 비활성을 disabled:로 쓰면 Tailwind가 aria-pressed:보다 먼저 출력해 선택+비활성 칩이 선택 색으로 남는다.
// 눌림·손가락 커서는 enabled:로 한정해 span 칩(제거용)은 누를 때 색·커서가 바뀌지 않고, button·Toggle로 그린 칩만 바뀐다.
// 아이콘은 Figma Chip 예시(chevron 5628:50·check 5628:56)대로 16px·선 1.5px이다. 기본 아이콘 선 1.8(createIcon)을 CSS로 덮는다
const chipVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full whitespace-nowrap transition-colors duration-120 ease-out enabled:cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none [&_svg:not([class*='size-'])]:size-[16px] [&_svg_*]:[stroke-width:1.5]",
  {
    variants: {
      variant: {
        solid:
          "bg-fill text-text enabled:active:bg-fill-strong aria-pressed:bg-primary aria-pressed:text-text-inverse aria-pressed:enabled:active:bg-primary-strong data-disabled:bg-fill data-disabled:text-text-disabled",
        // 선택+눌림 배경: Figma primary/subtle은 blue/50인데 코드 primary-subtle은 blue-100이라 원시 변수로 Figma 값에 맞춘다
        outline:
          "border border-border bg-fill-subtle text-text enabled:active:bg-fill-strong aria-pressed:border-primary-strong aria-pressed:text-primary-strong aria-pressed:enabled:active:bg-[var(--blue-50)] data-disabled:border-border data-disabled:text-text-disabled aria-pressed:data-disabled:bg-fill",
      },
      size: {
        lg: "min-h-11 px-4 text-label-l-emphasis data-disabled:text-label-l-regular",
        md: "min-h-9 px-4 text-label-m-emphasis data-disabled:text-label-m-regular",
        sm: "min-h-8 px-3 text-label-m-emphasis data-disabled:text-label-m-regular",
      },
      // Figma Selected=True·State=Enabled. 누를 수 없는 span 칩(고른 목적지)은 aria-pressed를 둘 수 없어 이 값으로 그린다
      selected: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      { variant: "solid", selected: true, className: "bg-primary text-text-inverse" },
      { variant: "outline", selected: true, className: "border-primary-strong text-primary-strong" },
    ],
    defaultVariants: { variant: "solid", size: "lg", selected: false },
  },
);

/**
 * Badge처럼 기본은 span이다. 누르는 칩은 render로 요소를 넘긴다(동작 버튼 `render={<button type="button" />}`, 고르는 칩 `render={<Toggle />}`).
 * 긴 라벨에 말줄임표가 필요하면 호출부가 라벨을 `<span className="min-w-0 truncate">`로 감싸고 칩에 폭 제한을 준다.
 */
function Chip({
  className,
  variant = "solid",
  size = "lg",
  selected = false,
  render,
  ...props
}: Readonly<useRender.ComponentProps<"span"> & VariantProps<typeof chipVariants>>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">({ className: cn(chipVariants({ variant, size, selected }), className) }, props),
    render,
    state: { slot: "chip", variant, size, selected: Boolean(selected) },
  });
}

// Figma Trailing Icon(close 16px, 라벨과 간격 6px). 누르는 영역은 음수 margin으로 28×44px까지만 넓힌다.
// 가로를 44px까지 넓히면 왼쪽이 간격 6px을 넘어 라벨 끝 8px을 덮는다(라벨 끝을 눌러도 지워짐). 오른쪽 6px은 칩 여백 16px 안이다
function ChipRemove({ className, ...props }: Readonly<ComponentProps<"button">>) {
  return (
    <button
      type="button"
      data-slot="chip-remove"
      className={cn(
        "-mx-1.5 -my-3.5 grid h-11 w-7 shrink-0 cursor-pointer place-items-center focus-visible:outline-2 focus-visible:outline-primary",
        className,
      )}
      {...props}
    >
      <CloseIcon size={16} />
    </button>
  );
}

export { Chip, ChipRemove };
