import { Select as SelectPrimitive } from "@base-ui/react/select";

import { CheckIcon, ChevronDownIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

// Figma 08 Dropdown의 Select(5047:440): Default 5047:164, Focused(=열림) 5047:230, Hover(=첫 옵션 hover) 5047:281, Filled 5047:336, Disabled 5047:390.
// Figma에 트리거 hover·키보드 포커스·오류, 옵션 선택됨·비활성, 목록 최대 높이·모션이 없다. 오류는 Text Field(1단계 Input) 모양을 빌리고 나머지는 지금 ExpenseSelect 값을 따른다

/**
 * 값 하나를 고르는 목록. modal은 false가 기본이다: 지금 드롭다운처럼 열린 동안 페이지 스크롤을 막지 않고 바깥 클릭이 뒤 요소에도 전달된다(Base UI 기본은 true).
 * 트리거에 고른 값의 라벨을 보이려면 `items`({ value: label } 또는 [{ value, label }])를 꼭 준다. 없으면 SelectValue가 원시 value를 그린다.
 * 비활성은 SelectTrigger가 아니라 여기 `disabled`로 준다. 숨은 input까지 비활성이 돼 FieldLabel이 회색으로 바뀐다.
 */
function Select<Value, Multiple extends boolean | undefined = false>({
  modal = false,
  ...props
}: Readonly<SelectPrimitive.Root.Props<Value, Multiple>>) {
  return <SelectPrimitive.Root modal={modal} {...props} />;
}

// Base UI는 상태 함수 className도 받지만 cn이 버리므로 배치용 문자열만 받는다
type SelectTriggerProps = Omit<SelectPrimitive.Trigger.Props, "className"> & { className?: string };

/**
 * Field 프레임(I5047:231;5046:254): 48px, padding L14 R10, gap 8, radius 8, fill/subtle, border/default. 1단계 Input과 높이·글자·왼쪽 여백이 같다.
 * 자식으로 SelectValue를 넣는다. 오류는 `aria-invalid`로 알린다(Field 안이면 FieldLabel도 빨개진다). 보이는 라벨이 없으면 `aria-label`을 단다.
 */
function SelectTrigger({ className, children, ...props }: Readonly<SelectTriggerProps>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        // 열림(Focused)은 primary/default 테두리. 키보드 포커스는 Figma에 없어 다른 ui 부품(Button 등)과 같은 outline이라 오류 테두리와 겹쳐도 보인다.
        // 오류 테두리는 열림·hover 중에도 남는다(Input의 Error Focused). Tailwind가 data-*를 aria-* 뒤에 출력해 열림 테두리는 not-aria-invalid로 한정한다.
        // hover는 Figma에 없어 지금 ExpenseSelect(테두리 primary 40%)를 Button outline과 같은 border/hover 토큰으로 옮겼다. 비활성·오류·열림에서는 걸지 않는다
        // Disabled: fill/default, text/disabled(플레이스홀더 포함, data-placeholder가 data-disabled 뒤에 출력돼 not-data-disabled로 한정). opacity는 쓰지 않는다
        "group/select-trigger flex min-h-12 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md border border-border bg-fill-subtle pl-3.5 pr-2.5 text-left text-body-m-regular text-text transition-colors select-none not-data-disabled:not-aria-invalid:not-data-popup-open:hover:border-border-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-invalid:border-status-negative data-placeholder:not-data-disabled:text-text-subtle data-popup-open:not-aria-invalid:border-primary data-disabled:cursor-not-allowed data-disabled:bg-fill data-disabled:text-text-disabled",
        className,
      )}
      {...props}
    >
      {children}
      {/* Trailing Icon 32×46 안에 chevron 20px icon/subtle(5046:256·257). Figma는 열리면 up 아이콘이라 down을 뒤집는다 */}
      <SelectPrimitive.Icon
        data-slot="select-icon"
        className="grid w-8 shrink-0 place-items-center self-stretch text-icon-subtle transition-transform duration-120 ease-out group-data-disabled/select-trigger:text-icon-disabled data-popup-open:rotate-180 motion-reduce:transition-none"
      >
        <ChevronDownIcon size={20} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

type SelectValueProps = Omit<SelectPrimitive.Value.Props, "className"> & { className?: string };

/**
 * 고른 값의 라벨, 없으면 `placeholder`(Figma 예시 "선택해 주세요")를 그린다. 글자색은 트리거가 정한다(값 text/default, 플레이스홀더 text/subtle).
 * Figma 값 칸은 한 줄(24px)이라 넘치면 말줄임한다
 */
function SelectValue({ className, ...props }: Readonly<SelectValueProps>) {
  return (
    <SelectPrimitive.Value data-slot="select-value" className={cn("min-w-0 flex-1 truncate", className)} {...props} />
  );
}

type SelectContentProps = Omit<SelectPrimitive.Popup.Props, "className"> & { className?: string } & Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >;

/**
 * 목록 패널(I5047:231;5046:216): 트리거 폭, 트리거 아래 4px, padding 0, radius 8, fill/elevation, border/default, shadow/default.
 * alignItemWithTrigger는 false가 기본이다: 지금 드롭다운처럼 늘 트리거 아래로 연다(Base UI 기본 true는 마우스로 열면 목록이 트리거를 덮는다).
 * 최대 높이는 Figma가 정하지 않아 지금 ExpenseSelect의 240px이고, 화면 아래 남은 높이를 넘지 않는다. 넘치면 목록 안에서 스크롤한다
 */
function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: Readonly<SelectContentProps>) {
  return (
    <SelectPrimitive.Portal>
      {/* 다른 body 포털 부품(대화상자 등)과 같은 z-50이라 나중에 여는 이 목록이 위에 뜬다 */}
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            // shadow/default(0 2 10 #1f2229 10%)는 그림자 토큰이 없어 임의값이다. 열림·닫힘 모션은 Figma에 없어 Base UI 예시의 짧은 페이드만 둔다
            "max-h-[min(15rem,var(--available-height))] w-(--anchor-width) origin-(--transform-origin) overflow-y-auto overscroll-contain rounded-md border border-border bg-fill-elevate shadow-[0_2px_10px_rgba(31,34,41,0.10)] outline-hidden transition-[opacity,scale] duration-100 ease-out data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0 motion-reduce:transition-none",
            className,
          )}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

type SelectItemProps = Omit<SelectPrimitive.Item.Props, "className"> & { className?: string };

/**
 * Select Option Item(I5047:231;5046:217): 56px, padding L14, Text 프레임 L2 R16, body/md/regular text/default, 아래 구분선 border/subtle 0.5px.
 * hover·키보드 이동(data-highlighted)은 fill/default(5047:333). 마지막 행의 구분선은 패널 테두리와 겹쳐 두 줄로 보여 뺀다.
 * 비활성 옵션은 Figma·지금 앱에 없어 Text Field Disabled 글자색(text/disabled)을 빌린다.
 * 선택됨 체크는 Trailing Icon 48×48 안 check 16px(5030:653·654)이다. 색은 Figma에서 확인 못 해 지금 ExpenseSelect 값(text-primary)이다
 */
function SelectItem({ className, children, ...props }: Readonly<SelectItemProps>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "flex min-h-14 w-full cursor-pointer items-center border-b-[0.5px] border-border-subtle pl-3.5 text-body-m-regular text-text outline-hidden select-none last:border-b-0 data-highlighted:bg-fill data-disabled:cursor-not-allowed data-disabled:text-text-disabled",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="min-w-0 flex-1 pl-0.5 pr-4 break-words">{children}</SelectPrimitive.ItemText>
      {/* 선택된 행에만 그린다(Base UI가 aria-hidden을 단다. 선택 여부는 role=option의 aria-selected로 읽힌다) */}
      <SelectPrimitive.ItemIndicator className="grid size-12 shrink-0 place-items-center text-primary">
        <CheckIcon size={16} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
