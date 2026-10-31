"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { cva, type VariantProps } from "class-variance-authority";
import { createContext, use, type ComponentProps, type TouchEvent } from "react";

import { CloseIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

// Figma ② Bottom Sheet 5924:13961(Height=Min·Half·BelowNav·BelowSafeArea). 모바일 기기 전용 아래 시트다. PC는 Dialog를 쓴다.
// 손잡이만 옛 MobileBottomSheet 값(36×4 border/subtle, DECISIONS)이고 제목·간격은 Figma 값이다. 옛 시트의 menu(제목 20·간격 8)/form(18·16) 두 모양은
// Figma에 없어 하나로 합쳤다(Figma Bottom Sheet는 제목 title/lg 하나, 영역 간격 20 하나).
// 저장 중 닫힘 막기(closeDisabled)·닫기 X 자리·Esc 처리는 Dialog(ui/dialog.tsx)와 같은 API다. 반응형 대화상자가 PC Dialog ↔ 모바일 Drawer로 껍데기만 바꾼다.
// 닫는 기준(높이 50% 또는 빠르게 튕김)·끌리는 곳·포커스·스크롤 잠금은 Base UI 기본이다. 옛 시트의 '80px 끌면 닫힘'은 없다.

// 터치 스와이프는 버튼·입력 위에서도 시작한다(Base UI DrawerViewport가 터치에는 제외 목록을 쓰지 않는다: ignoreSelectorWhenTouch false).
// 옛 시트(useSheetDrag)처럼 누르는 요소 위에서는 끌리지 않게, 터치가 닿은 요소에 Base UI 공식 제외 속성을 단다.
// Popup의 캡처 단계라 Viewport의 터치 처리보다 먼저 실행된다. 목록은 옛 useSheetDrag의 제외 목록과 같다
const SWIPE_IGNORE_TARGETS =
  "button, input, textarea, select, a, label, [role='button'], [role='checkbox'], [role='switch'], [role='radio'], [contenteditable='true']";

function ignoreSwipeOnControl(event: TouchEvent<HTMLDivElement>) {
  if (!(event.target instanceof Element)) return;
  event.target.closest(SWIPE_IGNORE_TARGETS)?.setAttribute("data-base-ui-swipe-ignore", "");
}

const DrawerCloseDisabledContext = createContext(false);
// DrawerContent가 DrawerHeader에 넘기는 닫기 X의 접근성 이름
const DrawerCloseLabelContext = createContext("닫기");

type DrawerProps = Omit<
  DrawerPrimitive.Root.Props,
  "swipeDirection" | "snapPoints" | "snapPoint" | "defaultSnapPoint" | "onSnapPointChange" | "snapToSequentialPoints"
> & {
  /** 저장 중처럼 닫으면 안 될 때 true. Esc·딤·X·취소(DrawerClose)·스와이프 닫기를 모두 막고 시트가 끌리지 않는다. 화면이 open을 false로 바꾸는 것(저장 성공 뒤 닫기)은 막지 않는다 */
  closeDisabled?: boolean;
};

/**
 * 아래 방향 스와이프로 닫히는 시트만 둔다(스냅·다른 방향은 이 부품의 모양이 지원하지 않는다).
 * 기본 modal(포커스 가둠·배경 스크롤 잠금). 닫힌 뒤 정리(폼 초기화 등)는 onOpenChangeComplete(false)에서 한다.
 * 안쪽 입력이 Esc를 먼저 쓰고 preventDefault했으면(추천 목록 닫기 등) 시트는 닫지 않는다.
 */
function Drawer({ closeDisabled = false, onOpenChange, ...props }: Readonly<DrawerProps>) {
  return (
    <DrawerCloseDisabledContext value={closeDisabled}>
      <DrawerPrimitive.Root
        onOpenChange={(open, eventDetails) => {
          // Base UI는 Esc를 Popup onKeyDown·document keydown에서 받고 defaultPrevented를 보지 않는다(useDismiss).
          // 둘 다 안쪽 입력의 React onKeyDown보다 뒤에 실행돼, 안쪽에서 preventDefault했으면 이 값이 채워져 있다
          const isEscapeUsedInside = eventDetails.reason === "escape-key" && eventDetails.event.defaultPrevented;
          // cancel()이면 스와이프로 끌던 시트도 제자리로 돌아간다
          if (!open && (closeDisabled || isEscapeUsedInside)) {
            eventDetails.cancel();
            return;
          }
          onOpenChange?.(open, eventDetails);
        }}
        {...props}
      />
    </DrawerCloseDisabledContext>
  );
}

/** 다른 요소로 그리려면 render(예: render={<Button variant="weak" />}). 트리거 없이 open으로 여는 시트는 쓰지 않는다 */
function DrawerTrigger(props: Readonly<DrawerPrimitive.Trigger.Props>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

/** Footer의 취소 버튼에 쓴다: <DrawerClose render={<Button variant="weak" />}>취소</DrawerClose>. closeDisabled이면 비활성으로 보인다 */
function DrawerClose({ disabled, ...props }: Readonly<DrawerPrimitive.Close.Props>) {
  const closeDisabled = use(DrawerCloseDisabledContext);
  return <DrawerPrimitive.Close data-slot="drawer-close" disabled={closeDisabled || disabled} {...props} />;
}

// 열기는 옛 시트처럼 아래에서 200ms(ease) 올라온다. 닫기는 Base UI 기본대로 내려가며 사라지고,
// 스와이프로 놓았을 때는 Base UI가 주는 세기(--drawer-swipe-strength 0.1~1)만큼 짧아진다(여기선 열기와 같은 200ms 기준).
// 손으로 끄는 동안(data-swiping)은 손가락을 바로 따라가게 transition을 끈다.
// 위로 끌면 Base UI가 조금 따라 올라가게(감쇠) 두므로, 시트 아래에 같은 색 띠(after)를 깔아 바닥과 틈이 보이지 않게 한다.
// 아래 여백은 Figma Sheet Surface 12(5924:13964)이고, safe-area가 더 크면 그 값을 쓴다(DECISIONS: safe-area 여백 유지)
const drawerPopupVariants = cva(
  "relative flex w-full flex-col rounded-t-[20px] bg-fill-elevate pb-[max(12px,env(safe-area-inset-bottom))] text-text outline-hidden [transform:translateY(var(--drawer-swipe-movement-y,0px))] transition-transform duration-200 ease-[ease] after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-12 after:bg-fill-elevate data-swiping:select-none data-swiping:duration-0 data-starting-style:[transform:translateY(calc(100%+2px))] data-ending-style:[transform:translateY(calc(100%+2px))] data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*200ms)] data-ending-style:data-swiping:duration-[calc(var(--drawer-swipe-strength,1)*200ms)] motion-reduce:transition-none",
  {
    variants: {
      size: {
        // Figma Height=Min(5924:13962)·Half(5924:13989)는 내용 높이(Hug)다. 최대 90dvh는 옛 MobileBottomSheet 값
        auto: "max-h-[90dvh]",
        // Figma Height=BelowNav(6211:4395): 상단 내비 아래 12px까지 채운다. 모바일 헤더는 56px(HeaderBar h-14)
        belowNav: "h-[calc(100dvh-68px)]",
        // Figma Height=BelowSafeArea(6211:4434): Safe Area 아래 12px까지 채운다
        belowSafeArea: "h-[calc(100dvh-env(safe-area-inset-top,0px)-12px)]",
      },
    },
    defaultVariants: { size: "auto" },
  },
);

// Base UI는 상태 함수 className도 받지만 cn이 버리므로 배치용 문자열만 받는다
type DrawerContentProps = Omit<DrawerPrimitive.Popup.Props, "className"> &
  VariantProps<typeof drawerPopupVariants> & {
    /** 닫기(X)의 접근성 이름. 화면에는 보이지 않는다(예: "메모 닫기") */
    closeLabel?: string;
    /** 배치에만 쓴다. 지금 화면별 고정 높이(예: h-[70dvh], max-h-[60dvh])를 옮길 때 */
    className?: string;
  };

/**
 * 딤·손잡이·표면을 그리고 children(Header·Body·Footer)을 세로로 쌓는다(영역 간격 20, Figma Sheet Surface 5924:13964).
 * Figma Header에는 제목 줄이 늘 있어(5924:13965) DrawerHeader를 늘 넣는다. 손잡이 아래 간격은 DrawerHeader까지 합쳐 Figma 값이 된다.
 * 열 때 포커스는 Base UI Drawer 기본대로 시트 자체로 간다(입력에 바로 포커스하려면 initialFocus={ref}).
 */
function DrawerContent({
  className,
  closeLabel = "닫기",
  size,
  children,
  onTouchStartCapture,
  ...props
}: Readonly<DrawerContentProps>) {
  const closeDisabled = use(DrawerCloseDisabledContext);
  return (
    <DrawerPrimitive.Portal data-slot="drawer-portal">
      {/* Figma Backdrop 5924:13963: #16181D(gray/950 값, 변수 바인딩 없음) 20%. 끄는 만큼 옅어지는 것은 Base UI 기본.
          iOS Safari에서 absolute로 두는 것은 Base UI 안내(body relative와 짝, globals.css).
          Base UI는 시트 안에서 연(nested) 시트의 딤을 그리지 않는다. 지금 앱처럼 뒤 시트도 딤으로 덮도록 forceRender로 늘 그린다.
          안쪽 시트의 딤은 끄는 동안 옅어지지 않고 닫힐 때 사라진다(Base UI가 nested 시트에는 끄는 진행도를 0으로 둔다, DrawerViewport) */}
      <DrawerPrimitive.Backdrop
        forceRender
        data-slot="drawer-overlay"
        className="fixed inset-0 z-50 min-h-dvh bg-[var(--gray-950)]/20 opacity-[calc(1-var(--drawer-swipe-progress,0))] transition-opacity duration-200 ease-[ease] data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*200ms)] data-ending-style:data-swiping:duration-[calc(var(--drawer-swipe-strength,1)*200ms)] motion-reduce:transition-none supports-[-webkit-touch-callout:none]:absolute"
      />
      {/* z-50은 다른 Base UI 팝업(dialog·select·popover 등)과 같은 값이다. 앱은 isolate로 묶여 있어(app-chrome-shell) 앱 안 z와는
          비교되지 않고, Base UI 팝업끼리는 나중에 연 것이 위에 온다(시트 안 Select 목록이 시트 위에 뜬다) */}
      <DrawerPrimitive.Viewport data-slot="drawer-viewport" className="fixed inset-0 z-50 flex flex-col justify-end">
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          // 저장 중에는 시트가 끌리지도 않게 한다(옛 시트와 같음). 닫기 자체는 Drawer의 cancel이 막는다
          data-base-ui-swipe-ignore={closeDisabled ? "" : undefined}
          onTouchStartCapture={(event) => {
            ignoreSwipeOnControl(event);
            onTouchStartCapture?.(event);
          }}
          className={cn(drawerPopupVariants({ size }), className)}
          {...props}
        >
          {/* 손잡이 36×4 border/subtle(옛 시트 값, DECISIONS). 위 12·아래 4는 Figma Header padding 위 12·행 간격 4(5924:13965). 장식이고 끄는 곳은 시트 전체다 */}
          <div aria-hidden data-slot="drawer-handle" className="flex shrink-0 justify-center pt-3 pb-1">
            <span className="h-1 w-9 rounded-full bg-border-subtle" />
          </div>
          {/* Drawer.Content 안에서는 마우스로 글자를 고를 때 시트가 끌리지 않는다(Base UI) */}
          <DrawerPrimitive.Content className="flex min-h-0 flex-1 flex-col gap-5">
            <DrawerCloseLabelContext value={closeLabel}>{children}</DrawerCloseLabelContext>
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  );
}

/**
 * 제목 줄(DrawerTitle + 닫기 X)과 그 아래 DrawerDescription. 닫기 X는 늘 그린다(Figma Title Row 5924:13968, 숨김 속성 없음).
 * Figma Header 5924:13965: 좌우 20, 행 간격 4. Title Row: 위 padding 8, 제목 Fill + Close 24, 사이 간격 0
 */
function DrawerHeader({ className, children, ...props }: Readonly<ComponentProps<"div">>) {
  const closeLabel = use(DrawerCloseLabelContext);
  const closeDisabled = use(DrawerCloseDisabledContext);
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-y-1 px-5 pt-2",
        className,
      )}
      {...props}
    >
      {children}
      {/* Close 24 icon/subtle + 누르는 영역 44(Figma). 영역은 음수 margin으로 되돌려 제목 줄 높이를 키우지 않는다 */}
      <DrawerPrimitive.Close
        data-slot="drawer-header-close"
        aria-label={closeLabel}
        disabled={closeDisabled}
        className="col-start-2 row-start-1 -m-2.5 grid size-11 shrink-0 place-items-center text-icon-subtle not-data-disabled:cursor-pointer focus-visible:outline-2 focus-visible:outline-primary data-disabled:text-icon-disabled"
      >
        <CloseIcon />
      </DrawerPrimitive.Close>
    </div>
  );
}

// Figma Title 5924:13969: title/lg text/default. h2. 한 줄로 줄인다(옛 시트와 같음)
function DrawerTitle({ className, ...props }: Readonly<Omit<DrawerPrimitive.Title.Props, "className"> & { className?: string }>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("truncate text-title-l text-text", className)}
      {...props}
    />
  );
}

// Figma Subtitle 5924:13973: caption/md/regular text/subtle. 예: 장소 이름
function DrawerDescription({
  className,
  ...props
}: Readonly<Omit<DrawerPrimitive.Description.Props, "className"> & { className?: string }>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("col-span-full truncate text-caption-m-regular text-text-subtle", className)}
      {...props}
    />
  );
}

/**
 * 스크롤되는 본문(Figma Body slot, 좌우 20). 높이가 넘치면 여기만 스크롤되고 제목 줄과 Footer는 고정이다.
 * 맨 위까지 스크롤된 상태에서 아래로 당기면 시트가 끌린다(Base UI 기본).
 * 안쪽 간격은 Figma 슬롯에 없어 넣는 내용이 정한다(메뉴 목록은 className="gap-2", 폼은 폼 컴포넌트의 gap). 같은 폼을 Dialog 본문에도 넣기 때문이다.
 * Dialog는 표면 전체가 스크롤돼 짝이 되는 Body 파트가 없다
 */
function DrawerBody({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="drawer-body"
      className={cn(
        // 위아래 4px은 스크롤 영역이 첫·마지막 항목의 포커스 윤곽(2px + 띄움 2px)을 자르지 않게 넓히고 음수 margin으로 되돌린 값이다
        "-my-1 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-1",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Figma Action 5924:13980: 위아래 12·좌우 16, 버튼 간격 8, 버튼은 각각 꽉 채운다. 순서는 취소(Neutral Weak) → 확인(Neutral Solid), 크기 md.
 * 그 아래 표면 여백 12(또는 safe-area)는 DrawerContent가 준다
 */
function DrawerFooter({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div data-slot="drawer-footer" className={cn("flex shrink-0 gap-2 px-4 py-3 *:min-w-0 *:flex-1", className)} {...props} />
  );
}

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerFooter,
};
