"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { createContext, use, type ComponentProps } from "react";

import { CloseIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

// Figma Modal 5956:24724: 353 고정 폭, padding 20, 영역(Header·Body·Footer) 간격 20, radius 12, fill/elevation, shadow/default.
// Figma Modal은 "컨테이너 자체"라 딤·가운데 배치·애니메이션이 없다(6038:6504). 그 셋은 지금 앱 값과 Base UI 권장 방식으로 채운다.
// 열림·닫힘은 Base UI data-starting-style·data-ending-style + transition이다(handbook/animation.md). 지금 PC 대화상자에는 애니메이션이 없어 짧은 fade·scale만 둔다.
// 저장 중 닫힘 막기(closeDisabled)·닫기 X 자리·Esc 처리는 Drawer(ui/drawer.tsx)와 같은 API다. 반응형 대화상자가 PC Dialog ↔ 모바일 Drawer로 껍데기만 바꾼다

const DialogCloseDisabledContext = createContext(false);
// DialogContent가 DialogHeader에 넘기는 닫기 X의 접근성 이름. null이면 X를 그리지 않는다(showCloseButton={false})
const DialogCloseLabelContext = createContext<string | null>(null);

type DialogProps = DialogPrimitive.Root.Props & {
  /** 저장 중처럼 닫으면 안 될 때 true. Esc·딤·X·취소(DialogClose)를 모두 막는다. 화면이 open을 false로 바꾸는 것(저장 성공 뒤 닫기)은 막지 않는다 */
  closeDisabled?: boolean;
};

/**
 * 열림 상태를 갖는 Root. `open`·`onOpenChange`로 제어하거나 DialogTrigger로 연다.
 * 안쪽 입력이 Esc를 먼저 쓰고 preventDefault했으면(추천 목록 닫기 등) 대화상자는 닫지 않는다.
 */
function Dialog({ closeDisabled = false, onOpenChange, ...props }: Readonly<DialogProps>) {
  return (
    <DialogCloseDisabledContext value={closeDisabled}>
      <DialogPrimitive.Root
        onOpenChange={(open, eventDetails) => {
          // Base UI는 Esc를 Popup onKeyDown·document keydown에서 받고 defaultPrevented를 보지 않는다(useDismiss).
          // 둘 다 안쪽 입력의 React onKeyDown보다 뒤에 실행돼, 안쪽에서 preventDefault했으면 이 값이 채워져 있다
          const isEscapeUsedInside = eventDetails.reason === "escape-key" && eventDetails.event.defaultPrevented;
          if (!open && (closeDisabled || isEscapeUsedInside)) {
            eventDetails.cancel();
            return;
          }
          onOpenChange?.(open, eventDetails);
        }}
        {...props}
      />
    </DialogCloseDisabledContext>
  );
}

function DialogTrigger(props: Readonly<DialogPrimitive.Trigger.Props>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

/** 대화상자를 닫는 버튼. 취소 버튼은 `render={<Button variant="weak" />}`로 그린다. closeDisabled이면 비활성으로 보인다 */
function DialogClose({ disabled, ...props }: Readonly<DialogPrimitive.Close.Props>) {
  const closeDisabled = use(DialogCloseDisabledContext);
  return <DialogPrimitive.Close data-slot="dialog-close" disabled={closeDisabled || disabled} {...props} />;
}

// 폭은 Figma 353을 기본으로 하고, 지금 화면마다 다른 폭은 size로 남긴다(Figma Modal은 최소·최대 폭 미정, 6058:1050).
// 화면 좌우 20px은 Figma 393 화면의 353 Modal 여백이다. 좁은 화면에서는 모든 size가 화면 폭 − 40px로 줄어든다(원칙 3-2)
const dialogContentVariants = cva(
  "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto overscroll-contain rounded-[12px] bg-fill-elevate p-5 text-text shadow-[0_2px_10px_rgb(31_34_41/0.1)] outline-none transition-[opacity,scale] duration-150 ease-out data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none",
  {
    variants: {
      size: {
        // Figma Modal 원본 폭(5956:24724). 날짜 선택 팝업(DatePickerLayer 최대 353)도 이 폭이다
        default: "w-[min(353px,calc(100vw-2.5rem))]",
        // 옛 앱 max-w-sm: 북마크 추가·편집, 북마크에 담기, 일정에 추가, 시간 설정. 쿠키 설정도 이 폭이다
        sm: "w-[min(384px,calc(100vw-2.5rem))]",
        // 옛 앱 max-w-md: SettingsDialog compact(준비물 이름), 가계부 범위 목록, 북마크에서 장소 추가. 초대하기도 이 폭이다
        md: "w-[min(448px,calc(100vw-2.5rem))]",
        // 옛 앱 max-w-[640px]: SettingsDialog 기본, 비용 추가·수정. 여행 정보 수정(600)도 여기에 둔다
        lg: "w-[min(640px,calc(100vw-2.5rem))]",
        // 옛 앱 max-w-[720px]: 정산 요약
        xl: "w-[min(720px,calc(100vw-2.5rem))]",
      },
    },
    defaultVariants: { size: "default" },
  },
);

type DialogContentProps = Omit<DialogPrimitive.Popup.Props, "className"> &
  VariantProps<typeof dialogContentVariants> & {
    /** 제목 줄 오른쪽 닫기(X). 기본 표시. Figma Modal에는 늘 있다 */
    showCloseButton?: boolean;
    /** 닫기(X)의 접근성 이름. 화면에는 보이지 않는다(예: "쿠키 설정 닫기") */
    closeLabel?: string;
    /** 배치(높이 상한 등)에만 쓴다. 폭은 size로 고른다 */
    className?: string;
  };

/**
 * 포털·딤·표면을 함께 그린다. 안에는 DialogHeader → 본문 → DialogFooter 순서로 넣는다(간격 20은 표면 gap이 준다).
 * 본문이 높이 상한을 넘으면 표면 전체가 스크롤된다. 긴 폼처럼 제목 줄·Footer를 고정하려면 본문을 DialogBody로 감싼다.
 * 닫기 X는 DialogHeader가 제목 줄에 그린다. DialogHeader 없이 본문으로 시작하는 대화상자에는 X가 없다(DialogClose를 직접 둔다).
 * 처음 포커스는 Base UI 기본(첫 포커스 요소, 터치로 열면 표면)이고, 바꾸려면 `initialFocus`·`finalFocus`를 넘긴다.
 */
function DialogContent({
  className,
  children,
  size,
  showCloseButton = true,
  closeLabel = "닫기",
  ...props
}: Readonly<DialogContentProps>) {
  return (
    <DialogPrimitive.Portal data-slot="dialog-portal">
      {/* 딤은 Figma에 정의가 없어(Modal 6038:6504) 옛 앱 대화상자에서 가장 많던 bg-black/40(SettingsDialog 등 14곳)을 쓴다.
          iOS 26 Safari는 fixed 딤이 스크롤 뒤 화면 전체를 덮지 못해 Base UI 권장대로 absolute로 바꾸고 min-h-dvh로 채운다(body는 globals.css에서 position: relative).
          Base UI는 다른 대화상자·시트 안에서 연(nested) 대화상자의 딤을 그리지 않는다. 지금 앱처럼 뒤 대화상자도 딤으로 덮도록 forceRender로 늘 그린다 */}
      <DialogPrimitive.Backdrop
        forceRender
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 min-h-dvh bg-black/40 transition-opacity duration-150 ease-out data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none supports-[-webkit-touch-callout:none]:absolute"
      />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(dialogContentVariants({ size }), className)}
        {...props}
      >
        <DialogCloseLabelContext value={showCloseButton ? closeLabel : null}>{children}</DialogCloseLabelContext>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

/**
 * Figma Header 6157:5571: Title Row → Subtitle, 간격 4. 제목 줄(DialogTitle + 닫기 X)과 그 아래 DialogDescription.
 * Title Row 6157:5574: 제목 Fill + Close 24, 사이 간격 0. 제목 줄에 다른 요소(아이콘·초기화 버튼)를 함께 두려면 첫 자식을 한 줄로 묶어 넣는다
 */
function DialogHeader({ className, children, ...props }: Readonly<ComponentProps<"div">>) {
  const closeLabel = use(DialogCloseLabelContext);
  const closeDisabled = use(DialogCloseDisabledContext);
  return (
    <div
      data-slot="dialog-header"
      className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-y-1", className)}
      {...props}
    >
      {children}
      {closeLabel !== null && (
        // Figma Close 24px icon/subtle + 투명 Touch Target 44×44(6157:5576). 영역은 음수 margin으로 되돌려 제목 줄 높이를 키우지 않는다.
        // hover는 Figma에 없어 옛 SettingsDialog의 원형 배경을 fill/default로 둔다
        <DialogPrimitive.Close
          data-slot="dialog-header-close"
          aria-label={closeLabel}
          disabled={closeDisabled}
          className="col-start-2 row-start-1 -m-2.5 grid size-11 place-items-center rounded-full text-icon-subtle transition-colors duration-120 ease-out not-data-disabled:cursor-pointer not-data-disabled:hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary data-disabled:text-icon-disabled motion-reduce:transition-none"
        >
          <CloseIcon size={24} />
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

/**
 * 본문만 스크롤하는 영역. 표면 높이 상한(화면 − 32px)을 넘으면 제목 줄·Footer는 제자리에 두고 이 안만 스크롤한다(예: 비용 추가·수정 폼).
 * 좌우는 표면 padding만큼 넓혀 스크롤 막대를 표면 가장자리에 붙이고, 위아래 4px은 첫·마지막 요소의 포커스 윤곽(2px + 띄움 2px)이 잘리지 않게 넓힌 값이다(DrawerBody와 같음)
 */
function DialogBody({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("-mx-5 -my-1 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-1", className)}
      {...props}
    />
  );
}

// Figma Footer: 높이 48(버튼 md), 간격 8, 버튼은 각자 Fill. 두 개면 취소(Neutral Weak) → 확인(Neutral Solid), 하나면 전체 폭이다
function DialogFooter({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex gap-2 *:min-w-0 *:flex-1", className)}
      {...props}
    />
  );
}

// Figma Title: title/lg, text/default, 왼쪽 정렬. aria-labelledby는 Base UI가 잇는다
function DialogTitle({ className, ...props }: Readonly<Omit<DialogPrimitive.Title.Props, "className"> & { className?: string }>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-title-l text-text", className)}
      {...props}
    />
  );
}

// Figma Subtitle: caption/md/regular, text/subtle("항목 · 항목" 같은 보조 줄). aria-describedby는 Base UI가 잇는다
function DialogDescription({
  className,
  ...props
}: Readonly<Omit<DialogPrimitive.Description.Props, "className"> & { className?: string }>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("col-span-full text-caption-m-regular text-text-subtle", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
