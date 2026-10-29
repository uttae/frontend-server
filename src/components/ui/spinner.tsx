import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { ProgressIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

// Figma에 Spinner 컴포넌트는 없어 progress 아이콘(type=default 252:30981)과 Button State=Loading의 아이콘 색을 따른다
const spinnerVariants = cva("inline-flex items-center justify-center", {
  variants: {
    variant: {
      default: "text-icon", // progress 원본색 icon/default
      inverse: "text-icon-inverse", // Solid 버튼 Loading의 icon/inverse(5272:2993·2994·3017)
    },
  },
  defaultVariants: { variant: "default" },
});

// width·height 속성만 주면 shadcn 부모의 [&_svg:not([class*='size-'])]:size-* 규칙에 덮여서 클래스로도 준다.
// 회전 속도는 Figma가 개발에 맡겨(5864:9498) animate-spin 기본값을 쓴다
const spinnerIconVariants = cva("motion-safe:animate-spin", {
  variants: {
    size: {
      12: "size-[12px]",
      16: "size-[16px]",
      20: "size-[20px]",
      24: "size-[24px]",
      28: "size-[28px]",
      32: "size-[32px]",
    },
  },
});

type SpinnerProps = Omit<ComponentProps<"output">, "children"> &
  VariantProps<typeof spinnerVariants> & {
    /** 아이콘 px(Figma 아이콘 크기). 아이콘 크기는 이 값으로만 바뀐다. className의 size-*는 output 칸 크기만 바꾼다 */
    size?: 12 | 16 | 20 | 24 | 28 | 32;
  };

/** 화면 문구 없이 aria-label로만 알린다. output의 암묵 role이 status라 role은 달지 않는다(Sonar S6819) */
function Spinner({ variant, size = 20, className, ...props }: Readonly<SpinnerProps>) {
  return (
    <output
      data-slot="spinner"
      aria-label="불러오는 중"
      className={cn(spinnerVariants({ variant }), className)}
      {...props}
    >
      <ProgressIcon size={size} className={spinnerIconVariants({ size })} />
    </output>
  );
}

export { Spinner };
