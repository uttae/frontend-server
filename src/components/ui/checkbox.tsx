import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { cva } from "class-variance-authority";

import { CheckboxActivatedIcon, CheckboxIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

// Figma ❸ Icon의 checkbox(5024:79)로 그린다. Default(5024:77)는 border/default, Activated(5024:78)는 primary/default 외곽선이다.
// md 24px은 아이콘 원본, sm 20px은 가계부 결제자·부담자 시안(4338:4508)의 인스턴스 크기다
const CHECKBOX_ICON_SIZE = { md: 24, sm: 20 } as const;

// size 속성만 주면 shadcn 부모의 [&_svg:not([class*='size-'])]:size-* 규칙에 덮여서 같은 px 클래스로도 준다
const checkboxIconVariants = cva("", {
  variants: {
    size: {
      md: "size-[24px]",
      sm: "size-[20px]",
    },
  },
});

type CheckboxProps = Omit<CheckboxPrimitive.Root.Props, "className" | "indeterminate"> & {
  size?: keyof typeof CHECKBOX_ICON_SIZE;
  // Base UI는 상태 함수 className도 받지만 cn이 버리므로 배치용 문자열만 받는다
  className?: string;
};

/**
 * 일부 선택(indeterminate)은 Figma mixed(252:31351)의 색·선이 Activated와 달라 정해질 때까지 받지 않는다.
 * 비활성 모양은 Figma에 없어 커서만 바꾼다. 준비물은 저장하는 동안 모든 체크박스를 비활성으로 바꿔서 흐리게 하면 체크할 때마다 깜빡인다.
 * 누르는 영역은 감싸는 label 행이 맡는다. after:로 넓히면 촘촘한 목록에서 이웃 행을 덮는다.
 */
function Checkbox({ className, size = "md", ...props }: Readonly<CheckboxProps>) {
  const iconSize = CHECKBOX_ICON_SIZE[size];
  const iconClassName = checkboxIconVariants({ size });
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "group/checkbox relative inline-flex shrink-0 cursor-pointer rounded-sm select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {/* Indicator는 해제한 뒤 한 프레임 늦게 빠져서 위에 겹쳐 그린다. 체크된 동안에도 이 아이콘이 자리를 잡도록 invisible로 숨긴다 */}
      <CheckboxIcon
        size={iconSize}
        className={cn(iconClassName, "text-border group-aria-checked/checkbox:invisible")}
      />
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="absolute inset-0">
        <CheckboxActivatedIcon size={iconSize} className={cn(iconClassName, "text-primary")} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
