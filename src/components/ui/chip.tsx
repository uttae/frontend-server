import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Figma 14 Chips: Chip / Solid 5625:359, Chip / Outline 5625:475
// Selected는 aria-pressed:, State=Pressed는 :active, Disabled는 data-disabled:로 그린다. Base UI의 data-pressed는 Selected라 눌림에 쓰지 않는다.
// 비활성을 disabled:로 쓰면 Tailwind가 aria-pressed:보다 먼저 출력해 선택+비활성 칩이 선택 색으로 남는다.
// 눌림은 enabled:로 한정해, 버튼이 아닌 요소(제거용 칩의 span)에 chipVariants를 써도 누를 때 색이 바뀌지 않게 한다.
const chipVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full whitespace-nowrap transition-colors duration-120 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none [&_svg:not([class*='size-'])]:size-[16px]",
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
    },
    defaultVariants: { variant: "solid", size: "lg" },
  },
);

type ChipProps = Omit<TogglePrimitive.Props, "className"> &
  VariantProps<typeof chipVariants> & {
    // Base UI는 상태 함수 className도 받지만 cn이 버리므로 배치용 문자열만 받는다
    className?: string;
  };

function Chip({ className, variant, size, ...props }: Readonly<ChipProps>) {
  return (
    <TogglePrimitive
      data-slot="chip"
      className={cn(
        chipVariants({ variant, size }),
        // 누르는 동작에만 필요한 클래스라 chipVariants에 두지 않는다. 두면 제거용 칩(span) 안의 버튼을 가상 요소가 덮는다.
        // md 36px·sm 32px는 모바일에서 누르는 영역만 가상 요소로 44px까지 넓힌다. 배경이 보이는 칩이라 padding·음수 margin(원칙 3-7)으로 넓히면 모양이 커진다.
        "relative cursor-pointer data-disabled:pointer-events-none [&_svg]:pointer-events-none mobile:before:absolute mobile:before:inset-x-0 mobile:before:top-1/2 mobile:before:h-11 mobile:before:-translate-y-1/2",
        className,
      )}
      {...props}
    />
  );
}

export { Chip, chipVariants };
