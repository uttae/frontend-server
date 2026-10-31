"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { useRef, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Figma 13 Alert Dialog: Alert Dialog 5621:3002(Purpose × Action Layout). 닫기 X는 없다(6058:535).
// Purpose는 버튼 Type으로 고른다: Notice·Confirmation 주요 = Neutral Solid(Button 기본), Destructive 주요 = Critical Solid(tone="critical"), 취소 = Neutral Weak(6058:516).
// 바깥 클릭은 Base UI AlertDialog가 막는다(disablePointerDismissal 강제). 딤을 눌러 닫으려면 AlertDialogContent의 backdropCloseLabel을 준다.
// 닫기 요청(Esc·취소·딤)은 모두 Root의 onOpenChange를 거친다. 처리 중에는 Root의 closeDisabled로 막는다(Dialog·Drawer와 같은 이름·의미).
//
// @example
// <AlertDialog open={open} onOpenChange={setOpen} closeDisabled={isDeleting}>
//   <AlertDialogContent backdropCloseLabel="여행 삭제 배경 닫기">
//     <AlertDialogHeader>
//       <AlertDialogTitle>여행을 삭제할까요?</AlertDialogTitle>
//       <AlertDialogDescription>삭제하면 되돌릴 수 없어요.</AlertDialogDescription>
//     </AlertDialogHeader>
//     <AlertDialogFooter>
//       <AlertDialogCancel>취소</AlertDialogCancel>
//       <AlertDialogAction tone="critical" loading={isDeleting} loadingLabel="삭제 중"
//         onClick={() => deleteRoom(undefined, { onSuccess: () => setOpen(false) })}>삭제</AlertDialogAction>
//     </AlertDialogFooter>
//   </AlertDialogContent>
// </AlertDialog>

type AlertDialogProps = AlertDialogPrimitive.Root.Props & {
  /** 처리 중처럼 닫으면 안 될 때 true. Esc·딤 닫기 버튼·취소(AlertDialogCancel)를 모두 막는다. 화면이 open을 false로 바꾸는 것(성공 뒤 닫기)은 막지 않는다 */
  closeDisabled?: boolean;
};

/**
 * Base UI AlertDialog.Root. 모달·role="alertdialog"는 고정이다. 메뉴 항목 등에서 열면 open·onOpenChange로 제어한다.
 * 안쪽 요소가 Esc를 먼저 쓰고 preventDefault했으면 닫지 않는다(Dialog와 같은 규칙).
 */
function AlertDialog({ closeDisabled = false, onOpenChange, ...props }: Readonly<AlertDialogProps>) {
  return (
    <AlertDialogPrimitive.Root
      data-slot="alert-dialog"
      onOpenChange={(open, eventDetails) => {
        // Base UI는 Esc를 document keydown(버블)에서 받아 defaultPrevented를 보지 않는다. 포털 안 React onKeyDown이 먼저 실행돼 이 값이 채워져 있다
        const escapeHandledInside = eventDetails.reason === "escape-key" && eventDetails.event.defaultPrevented;
        if (!open && (closeDisabled || escapeHandledInside)) {
          eventDetails.cancel();
          return;
        }
        onOpenChange?.(open, eventDetails);
      }}
      {...props}
    />
  );
}

/** 여는 버튼. 우리 Button으로 그리려면 render={<Button … />} */
function AlertDialogTrigger(props: Readonly<AlertDialogPrimitive.Trigger.Props>) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

// 딤은 Alert Dialog 페이지에 정의가 없어(figma-button-dialog 3-6) 지금 앱 값 black/40을 쓴다.
// 대화상자 안에서 연 확인창(중첩)도 딤을 그린다(forceRender). 확인창은 그림자가 없어 흰 대화상자 위에서 경계가 사라지고, 지금 확인창도 대화상자 위에 딤을 한 겹 더 깐다.
// iOS 26 Safari는 fixed 딤이 스크롤 뒤 화면을 다 덮지 못해 absolute로 둔다(Base UI 권장, body position: relative는 globals.css)
function AlertDialogOverlay({ closeLabel }: Readonly<{ closeLabel?: string }>) {
  return (
    <AlertDialogPrimitive.Backdrop
      forceRender
      data-slot="alert-dialog-overlay"
      className="fixed inset-0 z-50 min-h-dvh bg-black/40 transition-opacity duration-100 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none supports-[-webkit-touch-callout:none]:absolute"
    >
      {/* Base UI에 AlertDialog 바깥 닫기 옵션이 없어 딤 전체를 덮는 Close 버튼으로 연다(지금 SettingsDialog의 '배경 닫기' 버튼과 같은 구조).
          Close라 onOpenChange(false, reason "close-press")를 거치므로 closeDisabled면 거기서 막힌다. 키보드는 Esc로 닫으니 탭 순서에서 뺀다 */}
      {closeLabel && (
        <AlertDialogPrimitive.Close
          data-slot="alert-dialog-backdrop-close"
          tabIndex={-1}
          aria-label={closeLabel}
          className="absolute inset-0 size-full cursor-default"
        />
      )}
    </AlertDialogPrimitive.Backdrop>
  );
}

type AlertDialogContentProps = Omit<AlertDialogPrimitive.Popup.Props, "className" | "ref"> & {
  /** 배치(폭)에만 쓴다 */
  className?: string;
  /** 주면 딤을 눌러 닫힌다(지금 확인창 동작). 값은 딤 위 숨은 닫기 버튼의 이름이다(예: "{제목} 배경 닫기"). 없으면 Esc·취소로만 닫힌다 */
  backdropCloseLabel?: string;
  /** 확인창의 접근성 이름. AlertDialogTitle 없이(Figma Show Title=false) 쓸 때 꼭 준다. 제목이 있으면 Base UI가 aria-labelledby로 제목을 잇는다 */
  "aria-label"?: string;
};

// 폭: 원본 353(393 화면 − 좌우 20), 가이드 최대 400(5955:386). 좁은 화면은 좌우 20을 남기고 줄어든다.
// padding spacing/24, 세로 버튼 배치(Vertical 5621:2999·3001)만 아래 spacing/12. radius 10은 rounded-lg, Content–Actions 간격 20, 그림자 없음(5955:386), 바탕 fill/elevation.
// 최대 높이는 Figma 미정이라 dialog.tsx와 같은 규칙(화면 − 32px, 넘치면 안에서 스크롤)이다. 배경 스크롤이 잠겨 있어 가로 화면·글자 확대에서 버튼을 못 누르는 것을 막는다.
// z-50은 다른 Base UI 팝업(dialog·drawer·select 등)과 같은 값이다. 같은 z라 나중에 연 확인창이 대화상자·시트 위에 뜬다.
// 열림·닫힘은 shadcn 원본(fade + zoom 95%, 100ms)을 Base UI 전환 속성으로 옮긴 것이다

/**
 * 포털·딤·표면을 함께 그린다. 제목 없이 쓰면 aria-label을 준다.
 * 첫 포커스는 취소 버튼이다(없으면 Base UI 기본: 첫 포커스 요소, 터치로 열면 표면). 세로 배치(주요 → 취소)에서도 Enter 한 번에 파괴적 동작이 실행되지 않게 한다.
 * 바꾸려면 initialFocus를 넘긴다.
 */
function AlertDialogContent({ className, backdropCloseLabel, initialFocus, ...props }: Readonly<AlertDialogContentProps>) {
  const popupRef = useRef<HTMLDivElement>(null);
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal">
      <AlertDialogOverlay closeLabel={backdropCloseLabel} />
      <AlertDialogPrimitive.Popup
        ref={popupRef}
        data-slot="alert-dialog-content"
        // Base UI가 열린 뒤 호출한다(렌더 중 아님). 터치는 Base UI 기본(createDefaultInitialFocus)과 같이 표면, 비활성 취소는 기본(true)으로 넘긴다
        initialFocus={
          initialFocus ??
          ((interactionType) =>
            interactionType === "touch"
              ? popupRef.current
              : (popupRef.current?.querySelector<HTMLElement>(
                  "[data-slot=alert-dialog-cancel]:not([data-disabled])",
                ) ?? true))
        }
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(400px,calc(100vw-40px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto overscroll-contain rounded-lg bg-fill-elevate p-6 transition-[opacity,scale] duration-100 ease-out has-[[data-slot=alert-dialog-footer][data-layout=vertical]]:pb-3 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none",
          className,
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

/** Figma Content: 제목·본문 세로 간격 4, 가운데 정렬(5621:2819·2820) */
function AlertDialogHeader({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-1 text-center", className)}
      {...props}
    />
  );
}

// title/lg · text/default(5621:2819). Figma Show Title=false면 제목 없이 본문만 둔다(5955:298).
// 그때는 확인창 이름이 사라지므로 AlertDialogContent에 aria-label(예: "여행 삭제 확인")을 준다
function AlertDialogTitle({ className, ...props }: Readonly<AlertDialogPrimitive.Title.Props>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-title-l text-text", className)}
      {...props}
    />
  );
}

// body/lg/regular · text/subtle(5621:2820). 설명 문자열의 줄바꿈(\n)은 지금 확인창처럼 그대로 보인다(ConfirmDialog whitespace-pre-line)
function AlertDialogDescription({ className, ...props }: Readonly<AlertDialogPrimitive.Description.Props>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-body-l-regular whitespace-pre-line text-text-subtle", className)}
      {...props}
    />
  );
}

// Figma Actions: 버튼 md 48·간격 8·꽉 채움(5955:389). 자동 전환은 없어(6058:531) 문구가 길면 화면이 vertical을 고른다.
// 순서는 DOM 순서 그대로 보인다(포커스 순서와 같게): horizontal은 취소 → 주요(5621:2998), vertical은 주요 → 취소(5621:2999)로 적는다.
// vertical에서도 첫 포커스는 AlertDialogContent가 취소로 보낸다(주요가 먼저 있어도 Enter로 바로 실행되지 않음).
// 버튼이 하나(Notice · Single 5621:3000)면 horizontal에 주요 버튼만 넣는다
const alertDialogFooterVariants = cva("flex gap-2", {
  variants: {
    layout: {
      horizontal: "*:flex-1",
      vertical: "flex-col",
    },
  },
  defaultVariants: { layout: "horizontal" },
});

function AlertDialogFooter({
  className,
  layout = "horizontal",
  ...props
}: Readonly<ComponentProps<"div"> & VariantProps<typeof alertDialogFooterVariants>>) {
  return (
    <div
      data-slot="alert-dialog-footer"
      data-layout={layout}
      className={cn(alertDialogFooterVariants({ layout }), className)}
      {...props}
    />
  );
}

type AlertDialogActionProps = Omit<ComponentProps<typeof Button>, "variant" | "tone" | "size"> & {
  /** Neutral Solid(기본) · Critical Solid(삭제·탈퇴 같은 위험 동작). 브랜드 버튼은 확인창 유형에 없다(6058:517) */
  tone?: "neutral" | "critical";
};

/**
 * 주요 버튼. 누른다고 닫히지 않는 일반 Button이다 — 작업이 성공하면 화면이 open을 false로 바꾸고, 실패하면 열어 둔 채 오류를 보여 준다.
 * Solid md 48로 고정이다. 처리 중에는 loading(누를 수 없음, 폭 유지 progress)
 */
function AlertDialogAction({ tone = "neutral", ...props }: Readonly<AlertDialogActionProps>) {
  return <Button data-slot="alert-dialog-action" {...props} variant="solid" size="md" tone={tone} />;
}

type AlertDialogCancelProps = Omit<AlertDialogPrimitive.Close.Props, "className" | "render"> & {
  /** 배치에만 쓴다 */
  className?: string;
};

/**
 * 취소 버튼(Neutral Weak md). Base UI Close라 누르면 onOpenChange(false, reason "close-press")로 닫힌다.
 * closeDisabled면 눌러도 닫히지 않는다. 비활성으로 보이게 하는 것은 Figma가 따로 정하지 않아(6058:529 "취소를 Disabled로 만들지 않는다") 화면이 disabled로 정한다
 */
function AlertDialogCancel({ className, ...props }: Readonly<AlertDialogCancelProps>) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      render={<Button variant="weak" className={className} />}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
};
