"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode, type RefObject } from "react";

import { Dialog } from "@/components/ui/dialog";
import { Popover, PopoverContent } from "@/components/ui/popover";

type DatePickerPlacement =
  | { presentation: "popup" }
  | {
      presentation: "anchored";
      anchor: ComponentProps<typeof PopoverContent>["anchor"];
      boundaryRef: RefObject<HTMLElement | null>;
      sideOffset: number;
    };

/**
 * 달력 표시 방식 — `anchored`는 누른 입력 칸 아래에 붙는 Popover, `popup`은 화면 가운데 Dialog다.
 * 모바일과 스크롤되는 모달 안에서는 `popup`을 쓴다 (Figma Date Picker Usage).
 * `popup`은 가로 최소 300px이고, 화면보다 높으면(6주짜리 달·가로 모드) 달력 안에서 세로로 스크롤한다.
 * 닫힘은 둘 다 Esc = 취소(`onEscape`), 바깥 클릭·키보드로 벗어남 = 확정(`onDismiss`)이다.
 * 열고 닫힐 때 포커스는 Base UI에 맡기지 않는다: 열면 DatePicker가 날짜 칸으로 옮기고, 닫히면 아래 effect가 연 칸으로 돌려준다.
 * 열린 동안만 마운트한다(닫힘 애니메이션 없음, 지금과 같음).
 */
export function DatePickerLayer({
  placement,
  label,
  onDismiss,
  onEscape,
  children,
}: Readonly<{
  placement: DatePickerPlacement;
  label: string;
  /** 바깥 클릭·키보드로 레이어를 벗어날 때 */
  onDismiss: () => void;
  onEscape: () => void;
  children: ReactNode;
}>) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // 자식(DatePicker)이 날짜 칸으로 포커스를 옮기기 전, 렌더 시점의 포커스가 레이어를 연 칸이다
  const [opener] = useState(() => document.activeElement);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      // 레이어 안에 포커스가 있던 채로 닫히면 연 칸으로 돌려준다
      const active = document.activeElement;
      const focusWasInside = !active || active === document.body || dialog?.contains(active);
      if (focusWasInside && opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [opener]);

  if (placement.presentation === "anchored") {
    const { anchor, boundaryRef, sideOffset } = placement;
    return (
      // 포커스는 달력 안에서만 돈다(WAI-ARIA 날짜 선택 대화상자). 달력이 body로 포털돼 Tab으로 빠져나가면 다음 칸이 아니라 페이지 맨 앞으로 갔다.
      // 바깥 클릭은 그대로 뒤로 전달되고(확정), Esc는 취소다
      <Popover
        open
        modal="trap-focus"
        onOpenChange={(open, details) => {
          if (open) return;
          if (details.reason === "escape-key" || details.reason === "close-press") {
            onEscape();
            return;
          }
          const next = details.reason === "focus-out" ? document.activeElement : details.event.target;
          if (next instanceof Node && boundaryRef.current?.contains(next)) {
            details.cancel();
            return;
          }
          onDismiss();
        }}
      >
        <PopoverContent
          variant="bare"
          anchor={anchor}
          sideOffset={sideOffset}
          initialFocus={false}
          finalFocus={false}
          aria-label={label}
        >
          <div ref={dialogRef}>{children}</div>
          {/* Base UI는 닫기 부품이 있어야 포커스를 가둔다(PopoverPopup modal && hasClosePart). 화면 읽기 프로그램 터치 사용자가 빠져나갈 길이기도 하다.
              보이지 않고 Tab 순서에도 넣지 않는다(키보드는 Esc·달력의 취소). 누르면 Esc처럼 취소다 */}
          <PopoverPrimitive.Close tabIndex={-1} className="sr-only">
            날짜 선택 닫기
          </PopoverPrimitive.Close>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open, details) => {
        if (open) return;
        if (details.reason === "escape-key") onEscape();
        else onDismiss(); // 딤(바깥) 클릭 = 확정
      }}
    >
      <DialogPrimitive.Portal>
        {/* 표면은 DatePicker 카드가 그려 ui DialogContent(Modal 표면·여백) 대신 Base UI 파트로 지금 팝업 모양을 그대로 둔다.
            딤은 ui Dialog와 같은 값이고, 바깥 대화상자(여행 정보 수정) 위에서도 덮도록 forceRender로 늘 그린다 */}
        <DialogPrimitive.Backdrop
          forceRender
          className="fixed inset-0 z-50 min-h-dvh bg-black/40 supports-[-webkit-touch-callout:none]:absolute"
        />
        {/* 화면 폭이 300px+여백보다 좁으면 가운데 정렬이 양옆을 자르지 않게 왼쪽부터 놓고 가로로 스크롤한다 */}
        <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-center justify-center-safe overflow-x-auto p-4">
          <DialogPrimitive.Popup
            ref={dialogRef}
            aria-label={label}
            aria-modal
            initialFocus={false}
            finalFocus={false}
            className="max-h-full w-full min-w-[300px] max-w-[353px] overflow-y-auto overscroll-contain rounded-[12px] outline-none"
          >
            {children}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
