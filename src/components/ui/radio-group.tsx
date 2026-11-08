import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { RadioButtonIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

// Base UI는 상태 함수 className도 받지만 cn이 버리므로 배치용 문자열만 받는다
type RadioGroupProps = Omit<RadioGroupPrimitive.Props, "className"> & { className?: string };
type RadioGroupItemProps = Omit<RadioPrimitive.Root.Props, "className"> & { className?: string };

/** 항목 사이 간격은 쓰는 쪽이 className으로 정한다 */
function RadioGroup({ className, ...props }: Readonly<RadioGroupProps>) {
  return (
    <RadioGroupPrimitive data-slot="radio-group" className={cn("flex flex-col", className)} {...props} />
  );
}

// Figma ❸ Icon의 radio button(5024:68)으로 그린다. Default(5024:67)는 border/default 원, Activated(5024:65)는 primary/subtle 원과 10px primary 점이다.
// Activated 원: Figma primary/subtle은 blue/50인데 코드 primary-subtle은 blue-100이라 원시 변수로 Figma 값에 맞춘다.
// 비활성 모양은 Figma에 없어 커서만 바꾼다. 누르는 영역은 감싸는 label 행이 맡는다
function RadioGroupItem({ className, ...props }: Readonly<RadioGroupItemProps>) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer rounded-full text-border select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-checked:text-[var(--blue-50)] aria-disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {/* size 속성만 주면 shadcn 부모의 [&_svg:not([class*='size-'])]:size-* 규칙에 덮여서 같은 px 클래스로도 준다 */}
      <RadioButtonIcon size={24} className="size-[24px]" />
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="absolute inset-0 m-auto size-[10px] rounded-full bg-primary"
      />
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupItem };
