import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import type { ReactNode } from "react";

import { CheckIcon, ChevronDownIcon, SearchIcon } from "@/assets/icons";
import { SearchBar, SearchBarIcon, SearchBarInput } from "@/components/ui/search-bar";
import { cn } from "@/lib/utils";

// Figma 07 Select Field 5030:666 = 검색 입력 + 결과 목록. 입력은 Search Bar(5002:4433)와 같은 규격이라 ui/search-bar를 그대로 쓴다.
// Error·Disabled·선택 완료·아이템 선택·최대 높이·모션은 Figma에 없다(5912:493 "별도 지정·미정").
// 팝업 안 입력 패턴(Base UI combobox.md "Input inside popup")의 트리거는 07에 없어 08 Select(5047:440)의 Field 값을 빌린다

/** Base UI Combobox.Root. items·value·onValueChange·itemToStringLabel·filter로 값과 검색을 정한다. modal 기본 false(바깥 클릭이 뒤로 전달되고 스크롤을 잠그지 않는다) */
const Combobox = ComboboxPrimitive.Root;

// Base UI는 상태 함수 className도 받지만 cn(clsx)이 함수를 소리 없이 버리므로 배치용 문자열만 받는다(select.tsx와 같다)
type StringClassName<P> = Omit<P, "className"> & { className?: string };

// Figma Header Label(5030:658): label/xs/regular, text/default. 트리거와 간격 4는 감싸는 부모(Field)가 준다.
// 팝업 안 입력 패턴에서 트리거의 이름(aria-labelledby)으로 붙는다
function ComboboxLabel({ className, ...props }: Readonly<StringClassName<ComboboxPrimitive.Label.Props>>) {
  return (
    <ComboboxPrimitive.Label
      data-slot="combobox-label"
      className={cn("text-label-xs-regular text-text select-none", className)}
      {...props}
    />
  );
}

// 08 Select Field(Default 5047:164, Focused 5047:230, Disabled 5047:390): 48, padding L14 R10, gap 8, r8, fill/subtle, border/default.
// 열림(Focused)은 테두리 primary/default·chevron 위쪽, Disabled는 fill/default·text/disabled·icon/disabled. 트리거 hover는 Figma에 없다.
// Disabled에도 자리표시 글자가 있어 자리표시 색은 비활성이 아닐 때만 준다
function ComboboxTrigger({ className, children, ...props }: Readonly<StringClassName<ComboboxPrimitive.Trigger.Props>>) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn(
        "group/combobox-trigger flex min-h-12 w-full min-w-0 items-center gap-2 rounded-md border border-border bg-fill-subtle pl-3.5 pr-2.5 text-start text-body-m-regular text-text transition-colors not-data-disabled:cursor-pointer focus-visible:outline-2 focus-visible:outline-primary data-placeholder:not-data-disabled:text-text-subtle data-popup-open:border-primary data-disabled:cursor-not-allowed data-disabled:bg-fill data-disabled:text-text-disabled motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {/* Trailing Icon 래퍼 32×46(5046:256): 칸 안쪽 높이를 채운다 */}
      <span
        aria-hidden
        className="grid w-8 shrink-0 place-items-center self-stretch text-icon-subtle group-data-disabled/combobox-trigger:text-icon-disabled"
      >
        <ChevronDownIcon size={20} className="group-data-popup-open/combobox-trigger:rotate-180" />
      </span>
    </ComboboxPrimitive.Trigger>
  );
}

/**
 * 선택값의 글자. 자기 요소 없이 글자만 돌려준다(className 없음).
 * children이 없으면: 값이 있을 때 Root의 itemToStringLabel로 그리고, 값이 없을 때 placeholder를 그린다.
 * children이 있으면(함수 포함) placeholder는 쓰이지 않는다(ComboboxValue.mjs). 함수 children이면 값이 없을 때의 글자도 함수가 돌려준다.
 * 값이 없어도 트리거의 data-placeholder는 붙으므로 자리표시 색은 어느 쪽이든 유지된다.
 * @example
 * // 정석: itemToStringLabel + placeholder
 * <Combobox items={currencies} itemToStringLabel={(c) => c.currency}>
 *   <ComboboxTrigger><ComboboxValue placeholder="통화 선택" /></ComboboxTrigger>
 * </Combobox>
 * // 글자를 따로 만들 때: 값 없음도 함수 안에서 처리
 * <ComboboxValue>{(c: Currency | null) => (c ? `${c.currency} ${c.name}` : "통화 선택")}</ComboboxValue>
 */
const ComboboxValue = ComboboxPrimitive.Value;

type ComboboxContentProps = StringClassName<ComboboxPrimitive.Popup.Props> &
  Pick<ComboboxPrimitive.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset">;

// Figma 목록(I5030:670;5030:661)은 입력과 간격 4, 폭은 입력과 같다. 표면(테두리·배경)은 팝업이 아니라 입력·목록·빈 결과가 각자 갖고
// 팝업은 그것을 간격 4로 쌓기만 한다(팝업 안 입력의 배치는 Figma에 없어 07의 입력–목록 간격을 그대로 쓴다). 그림자는 Figma에 없다.
// z-50은 ui 대화상자와 같은 값이다. 나중에 연 포털이 body 뒤쪽에 붙어 대화상자 안에서 열어도 그 위에 뜬다.
// 열림·닫힘 모션은 Figma가 정하지 않아 짧은 투명도 전환만 둔다
/**
 * Portal + Positioner + Popup. 기본은 아래(side="bottom")·왼쪽 맞춤(align="start")·간격 4(sideOffset=4)·폭은 트리거(입력) 폭이다.
 * 폭을 바꾸려면 className에 w-*를 준다(예: 좁은 트리거면 `w-[min(20rem,calc(100vw-2rem))]`). 팝업 안 입력 패턴이면 aria-label을 단다.
 */
function ComboboxContent({
  className,
  side = "bottom",
  align = "start",
  sideOffset = 4,
  alignOffset = 0,
  ...props
}: Readonly<ComboboxContentProps>) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        className="z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            "flex max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) flex-col gap-1 outline-hidden transition-opacity duration-150 ease-out data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none",
            className,
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

type ComboboxInputProps = StringClassName<ComboboxPrimitive.Input.Props> & {
  /** SearchBarInput처럼 꼭 받는다. 값이 있는지(Filled 테두리)를 :placeholder-shown으로 읽는다 */
  placeholder: string;
  /** 입력 뒤 Trailing Icon 자리(32×48). 검색어 지우기는 SearchBarClear를 넣는다 */
  children?: ReactNode;
};

// Figma Search Bar(5002:4433)와 같다: 앞 돋보기 20 icon/subtle, 포커스 테두리 primary/default.
// Combobox.InputGroup을 SearchBar로 그려서, 입력이 트리거인 패턴에서도 팝업이 입력 요소가 아니라 칸 전체 폭에 붙는다.
// Base UI Combobox.Clear는 검색어와 함께 선택값까지 지워서 팝업 안 입력 패턴에 맞지 않아 두지 않는다
/** 검색 입력. 팝업 안 입력 패턴이면 ComboboxContent 안 첫 자식으로, 입력이 트리거인 패턴이면 ComboboxContent 밖에 둔다. className은 칸(SearchBar)에 간다 */
function ComboboxInput({ className, placeholder, children, ...props }: Readonly<ComboboxInputProps>) {
  return (
    <ComboboxPrimitive.InputGroup
      data-slot="combobox-input-group"
      render={<SearchBar />}
      className={cn("shrink-0", className)}
    >
      <SearchBarIcon>
        <SearchIcon size={20} />
      </SearchBarIcon>
      <ComboboxPrimitive.Input
        data-slot="combobox-input"
        render={<SearchBarInput placeholder={placeholder} />}
        {...props}
      />
      {children}
    </ComboboxPrimitive.InputGroup>
  );
}

// Figma 목록 표면(I5030:670;5030:661): fill/subtle, border/default 1px, r8, padding 0, 행 사이 gap 0.
// 최대 높이는 Figma가 정하지 않아("별도 지정") 지금 통화 목록 값 max-h-52를 기본으로 두고, 화면 높이가 모자라면 팝업 안에서 더 줄어든다.
// 결과가 없으면 숨기고 ComboboxEmpty가 같은 표면을 그린다
/** 결과 목록. children에 (item) => <ComboboxItem key value={item}>를 넘기면 Root items의 걸러진 결과로 그린다 */
function ComboboxList({ className, ...props }: Readonly<StringClassName<ComboboxPrimitive.List.Props>>) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        "max-h-52 min-h-0 overflow-y-auto overscroll-contain rounded-md border border-border bg-fill-subtle data-empty:hidden",
        className,
      )}
      {...props}
    />
  );
}

type ComboboxItemProps = StringClassName<ComboboxPrimitive.Item.Props> & {
  /** Leading Icon 자리(20px, icon/subtle). @/assets/icons 아이콘을 size={20}으로 넣는다 */
  icon?: ReactNode;
  /** 부제(Subtitle). 제목은 children */
  description?: ReactNode;
};

// Figma Select Option Item(5030:646) 07 사용형: 행 56, padding L14·R0, Text 래퍼 R16, 아래 구분선 border/subtle 0.5px.
// 제목 body/sm/emphasis text/default, 부제 caption/md/regular text/subtle(5030:651·652).
// 아이콘–글자 10(Text 래퍼 L10)은 gap 8 + 래퍼 L2로 둔다. 아이콘이 없으면 08 Select의 재정의(5046:217)처럼 L14 + L2가 된다.
// Hover(5030:671)는 Base UI가 포인터·키보드 강조에 함께 다는 data-highlighted로 그린다: 배경 fill/default, 부제 gray/800(Figma도 원시 변수에 묶었다).
// 마지막 행 구분선은 Figma에서 목록 테두리(INSIDE 1px)에 덮여 보이지 않아 뺀다.
// 선택됨·비활성 State는 Figma에 없다. 선택 표시는 Trailing Icon 슬롯(5030:653, 행 오른쪽 끝 48×48 안 check 16×16 5030:654)을
// Base UI ItemIndicator로 켠다. 선택된 행에만 그려져서, 선택 안 된 행은 Text 래퍼 R16이 그대로 오른쪽 끝이다.
// 체크 색은 Figma 인스턴스에서 읽히지 않아(루트 fill #ffffff만 있음) 지금 통화 선택 화면 값 primary를 쓴다(디자이너 확인 필요).
// 선택 행 배경은 Figma에 없어 두지 않는다
function ComboboxItem({ className, icon, description, children, ...props }: Readonly<ComboboxItemProps>) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "group/combobox-item flex min-h-14 w-full cursor-pointer items-center gap-2 border-b-[0.5px] border-border-subtle pl-3.5 outline-hidden select-none last:border-b-0 data-highlighted:bg-fill",
        className,
      )}
      {...props}
    >
      {icon && (
        <span aria-hidden className="flex shrink-0 text-icon-subtle">
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col pr-4 pl-0.5">
        <span className="text-body-s-emphasis wrap-break-word text-text">{children}</span>
        {description && (
          <span className="text-caption-m-regular text-text-subtle group-data-highlighted/combobox-item:text-[var(--gray-800)]">
            {description}
          </span>
        )}
      </span>
      <ComboboxPrimitive.ItemIndicator className="grid size-12 shrink-0 place-items-center text-primary">
        <CheckIcon size={16} />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

// Figma Empty(I5030:679;5030:661;5030:678): 목록과 같은 표면에 행 56 하나, 아이콘 없음, 글자 왼쪽 18(padding L14 + 래퍼 L4)·오른쪽 16, body/sm/regular text/subtle.
// 높이는 목록 행 하나와 같은 58(행 56 + 테두리 위아래 1, Empty 프레임 130 = 16 + 4 + 48 + 4 + 58). border-box라 min-h에 테두리를 더한다.
// Base UI Empty는 결과가 있으면 자식만 비우고, 알림 영역(role=status)은 숨기지 말고 DOM에 남겨야 해서 표면은 자식 div가 갖는다.
// 자식이 빈 동안에는 absolute로 흐름에서만 빼서 팝업 gap 4가 하나 더 생기지 않게 한다
/** 결과가 없을 때의 문구. Root에 items를 줘야 동작한다. 화면에 늘 두고 children에 문구만 넣는다 */
function ComboboxEmpty({ className, children, ...props }: Readonly<StringClassName<ComboboxPrimitive.Empty.Props>>) {
  return (
    <ComboboxPrimitive.Empty data-slot="combobox-empty" className={cn("empty:absolute", className)} {...props}>
      <div className="flex min-h-14.5 items-center rounded-md border border-border bg-fill-subtle pl-4.5 pr-4 text-body-s-regular text-text-subtle">
        {children}
      </div>
    </ComboboxPrimitive.Empty>
  );
}

export {
  Combobox,
  ComboboxLabel,
  ComboboxTrigger,
  ComboboxValue,
  ComboboxContent,
  ComboboxInput,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
};
