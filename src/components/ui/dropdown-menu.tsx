import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Figma 08 Dropdown: Dropdown Menu 5864:13084(Type=Default 5864:11039 · Profile 5864:13083), Item 5956:16861(Size=sm 5956:16698 · lg 5956:16862)
// Figma에 없는 상태(hover·키보드 강조·비활성)는 지금 앱 메뉴 값을 쓴다(RoomCardMenu·HomeHeader의 hover:bg-fill focus-visible:bg-fill).
// 키보드 포커스는 강조 배경만으로는 흰 표면과 거의 구분되지 않아 윤곽선을 더한다(principles 3-7).
// 체크·라디오 항목, 구분선, 그룹 라벨, 단축키는 Figma와 지금 화면 모두에 없어 두지 않는다

/**
 * 동작 메뉴의 Root. 기본 modal={false}: 지금 메뉴들은 바깥을 누르면 닫히면서 그 클릭이 뒤 요소에도 전달되고 페이지 스크롤을 막지 않는다.
 * Base UI 기본(true)은 바깥 첫 클릭을 막고 스크롤을 잠근다. 대화상자 안에서 열린 상태를 직접 다루면 open·onOpenChange를 쓴다
 */
function DropdownMenu({ modal = false, ...props }: Readonly<MenuPrimitive.Root.Props>) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" modal={modal} {...props} />;
}

/**
 * `<button type="button">`을 그리고 열림에 따라 aria-expanded·data-popup-open을 단다. 모양은 화면이 정한다(열림 표시는 aria-expanded:bg-fill).
 * 다른 부품으로 그리려면 render(`render={<Button variant="weak" size="sm" />}`)
 */
function DropdownMenuTrigger(props: Readonly<MenuPrimitive.Trigger.Props>) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

type DropdownMenuContentProps = Omit<MenuPrimitive.Popup.Props, "className"> &
  Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset"> & {
    /** 배치(폭)만. 기본은 내용 폭에 맞추고 최소 160px(Figma minWidth). 프로필 메뉴처럼 정한 폭은 `w-60` */
    className?: string;
    /** Figma Item Size. sm(48, Type=Default) / lg(50, Type=Profile). 안의 항목이 모두 이 크기를 따른다 */
    size?: "sm" | "lg";
  };

/**
 * Portal + Positioner + Popup. 트리거 아래(side="bottom")에 4px 띄워 연다.
 * align 기본은 shadcn대로 "start"(트리거 왼쪽 맞춤)이고, 지금 메뉴 대부분은 오른쪽 끝 맞춤이라 화면에서 align="end"를 준다.
 * 간격·정렬은 Figma에 정의가 없다("열리는 방향·화면 경계 대응은 구현 시 별도")
 */
function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  size = "sm",
  className,
  ...props
}: Readonly<DropdownMenuContentProps>) {
  return (
    <MenuPrimitive.Portal>
      {/* z-50은 다른 shadcn 팝업과 같은 값이다. 앱 내용은 isolate로 감싸 있어 body 포털 팝업이 앱 위에 뜬다(app-chrome-shell) */}
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          data-size={size}
          className={cn(
            // 5864:11039: padding 0, radius/lg 12(토큰 없음, rounded-lg = 10px), fill/elevation, 테두리 없음, shadow/default 0 2 10 #1f2229 10%(그림자 토큰 없음).
            // 화면이 좁으면 남은 폭·높이(--available-*)까지만 커지고 넘치는 항목은 스크롤한다. 둥근 모서리 밖 항목 배경은 overflow로 잘린다
            "group/dropdown-menu flex w-max max-w-(--available-width) min-w-40 max-h-(--available-height) flex-col overflow-x-hidden overflow-y-auto rounded-[12px] bg-fill-elevate shadow-[0_2px_10px_#1f22291a] outline-none",
            // 열림·닫힘: Figma 정의 없음. 지금 BookmarkPlaceRow 메뉴의 fade + zoom 95%·150ms를 transition으로 옮겼다.
            // 키보드로 열고 닫거나 Esc로 닫으면 Base UI가 data-instant를 달아 바로 나타나고 사라진다
            "origin-(--transform-origin) transition-[opacity,scale] duration-150 ease-out data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 data-instant:transition-none motion-reduce:transition-none",
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

// Item 5956:16698(sm): padding T14 R16 B14 L16, gap 8, label/md/regular text/default, 아이콘 20 icon/default.
// 5956:16862(lg): 좌우 20, label/lg/regular. 높이 48·50은 padding + 글자 행간(20·22)으로 나온다(글자가 커지면 같이 늘어난다).
// 구분선은 모든 행(마지막 포함) 아래 border/subtle 0.5px. Figma는 높이에 넣지 않아 테두리 대신 안쪽 그림자로 그린다(지금 RoomCardMenu와 같음).
// 강조는 Base UI가 hover·화살표 키 모두에 다는 data-highlighted 배경 fill/default다(지금 앱 hover·focus-visible:bg-fill).
// fill/default(#f6f6f8)는 표면 fill/elevate(#ffffff)와 대비가 약해 키보드 포커스에는 안쪽 primary 윤곽선을 더한다.
// 포인터로 연 메뉴는 hover가 항목에 포커스를 옮겨도 focus-visible이 아니라 배경만 바뀐다. 둥근 모서리 밖은 Popup overflow가 자르므로 안쪽(-outline-offset-2)에 그린다.
// 비활성: Figma·지금 앱 모두 없음. Button과 같이 opacity 대신 text/disabled·icon/disabled 토큰을 쓴다
const dropdownMenuItemVariants = cva(
  "flex w-full min-w-0 cursor-pointer items-center gap-2 px-4 py-3.5 text-left text-label-m-regular text-text shadow-[inset_0_-0.5px_0_var(--color-border-subtle)] select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary data-highlighted:bg-fill data-disabled:cursor-not-allowed data-disabled:text-text-disabled group-data-[size=lg]/dropdown-menu:px-5 group-data-[size=lg]/dropdown-menu:text-label-l-regular [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-icon [&_svg:not([class*='size-'])]:size-5 data-disabled:[&_svg]:text-icon-disabled",
  {
    variants: {
      variant: {
        default: "",
        // 5956:16735 "방 삭제하기": 글자 status/negative/strong(#c10000, 시맨틱 토큰 없음), 아이콘 status/negative/default.
        // 지금 앱은 글자도 status-negative(#ff2035)라 조금 진해진다
        destructive: "text-[var(--red-800)] [&_svg]:text-status-negative",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type DropdownMenuItemProps = Omit<MenuPrimitive.Item.Props, "className"> &
  VariantProps<typeof dropdownMenuItemVariants> & { className?: string };

/**
 * 동작 항목. 아이콘(@/assets/icons)은 글자 앞 직계 자식으로 넣는다(크기·색은 항목이 정한다).
 * 누르면 메뉴가 닫히고 포커스가 트리거로 돌아간다. 이동·편집처럼 성공 뒤에 닫아야 하는 항목은 closeOnClick={false}로 두고 성공 콜백에서 닫는다.
 * 대화상자를 여는 항목은 onClick에서 controlled 대화상자의 open을 켠다(Base UI menu.md "Open a dialog")
 */
function DropdownMenuItem({ className, variant = "default", ...props }: Readonly<DropdownMenuItemProps>) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      className={cn(dropdownMenuItemVariants({ variant }), className)}
      {...props}
    />
  );
}

type DropdownMenuLinkItemProps = Omit<MenuPrimitive.LinkItem.Props, "className"> &
  VariantProps<typeof dropdownMenuItemVariants> & { className?: string };

/**
 * 이동 항목(`<a>`). 앱 안 이동은 Next Link를 render로 넘긴다: `<DropdownMenuLinkItem render={<Link href="/home/my-info" />}>내 정보</DropdownMenuLinkItem>`.
 * 외부 링크는 href·target·rel을 그대로 준다.
 * closeOnClick 기본 true: Base UI 기본(false)은 Next 클라이언트 이동 뒤에도 헤더 메뉴가 열려 있다. 지금 HeaderBar·HomeHeader는 링크를 누르면 닫는다
 */
function DropdownMenuLinkItem({
  className,
  variant = "default",
  closeOnClick = true,
  ...props
}: Readonly<DropdownMenuLinkItemProps>) {
  return (
    <MenuPrimitive.LinkItem
      data-slot="dropdown-menu-link-item"
      data-variant={variant}
      closeOnClick={closeOnClick}
      className={cn(dropdownMenuItemVariants({ variant }), className)}
      {...props}
    />
  );
}

// Profile Header 5864:13003: padding T20 R16 B20 L20, gap 4, 아래 구분선 border/subtle 0.5px.
// 메뉴 항목이 아니라 키보드 탐색에서 건너뛴다. 스크린리더에 사용자 이름이 필요하면 트리거 aria-label에 넣는다
function DropdownMenuHeader({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="dropdown-menu-header"
      className={cn(
        "flex min-w-0 flex-col gap-1 py-5 pr-4 pl-5 shadow-[inset_0_-0.5px_0_var(--color-border-subtle)]",
        className,
      )}
      {...props}
    />
  );
}

// 닉네임: label/xl/emphasis text/default. Figma 행간 22, 코드 토큰 24(Button lg와 같은 차이)라 Header 높이가 86 → 88
function DropdownMenuHeaderTitle({ className, ...props }: Readonly<ComponentProps<"p">>) {
  return (
    <p
      data-slot="dropdown-menu-header-title"
      className={cn("truncate text-label-xl-emphasis text-text", className)}
      {...props}
    />
  );
}

// 이메일: body/sm/regular text/subtle
function DropdownMenuHeaderDescription({ className, ...props }: Readonly<ComponentProps<"p">>) {
  return (
    <p
      data-slot="dropdown-menu-header-description"
      className={cn("truncate text-body-s-regular text-text-subtle", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuHeader,
  DropdownMenuHeaderTitle,
  DropdownMenuHeaderDescription,
};
