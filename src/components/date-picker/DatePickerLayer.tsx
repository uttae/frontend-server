"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { Dialog } from "@/components/ui/dialog";
import { Popover, PopoverContent } from "@/components/ui/popover";

import { DATE_PICKER_WIDTH } from "./DatePicker";

export type DatePickerPresentation = "anchored" | "popup";

/**
 * 달력 표시 방식 — `anchored`는 누른 입력 칸 아래에 붙는 Popover, `popup`은 화면 가운데 Dialog다.
 * 모바일과 스크롤되는 모달 안에서는 `popup`을 쓴다 (Figma Date Picker Usage).
 * `anchored`는 입력 칸 폭에 맞춰 달력 전체를 같은 비율로 줄이거나 늘린다.
 * `popup`은 가로 최소 300px이고, 화면보다 높으면(6주짜리 달·가로 모드) 달력 안에서 세로로 스크롤한다.
 * 닫힘은 둘 다 Esc = 취소(`onEscape`), 바깥 클릭·키보드로 벗어남 = 확정(`onDismiss`)이다.
 * 열고 닫힐 때 포커스는 Base UI에 맡기지 않는다: 열면 DatePicker가 날짜 칸으로 옮기고, 닫히면 아래 effect가 연 칸으로 돌려준다.
 * 열린 동안만 마운트한다(닫힘 애니메이션 없음, 지금과 같음).
 */
export function DatePickerLayer({
  presentation,
  anchorRef,
  boundaryRef,
  label,
  onDismiss,
  onEscape,
  children,
}: Readonly<{
  presentation: DatePickerPresentation;
  /** `anchored`에서 달력을 붙일 입력 칸 — 달력 폭·비율의 기준 */
  anchorRef?: RefObject<HTMLElement | null>;
  /** `anchored`에서 바깥 클릭·포커스 이탈 판정 범위 — 입력 칸 두 개를 함께 감싼 요소 */
  boundaryRef?: RefObject<HTMLElement | null>;
  label: string;
  /** 바깥 클릭·키보드로 레이어를 벗어날 때 */
  onDismiss: () => void;
  onEscape: () => void;
  children: ReactNode;
}>) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // 자식(DatePicker)이 날짜 칸으로 포커스를 옮기기 전, 렌더 시점의 포커스가 레이어를 연 칸이다
  const [opener] = useState(() => document.activeElement);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      // 레이어 안에 포커스가 있던 채로 닫히면 연 칸으로 돌려준다
      const active = document.activeElement;
      const focusWasInside = !active || active === document.body || dialog?.contains(active);
      if (focusWasInside && opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [opener]);

  // 첫 페인트 전에 입력 칸 폭을 재서 달력 비율을 맞춘다. 달력(Popover bare)은 이 칸과 같은 폭이다
  useLayoutEffect(() => {
    const anchor = anchorRef?.current;
    if (presentation !== "anchored" || !anchor) return;
    const fit = () => setZoom(anchor.clientWidth / DATE_PICKER_WIDTH);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [presentation, anchorRef]);

  if (presentation === "anchored") {
    return (
      <Popover
        open
        onOpenChange={(open, details) => {
          if (open) return;
          if (details.reason === "escape-key") {
            onEscape();
            return;
          }
          // 두 칸 묶음 안(다른 날짜 칸)을 누르거나 그리로 포커스가 가면 닫지 않는다. 그 칸의 onClick이 달력을 다시 붙인다
          const next = details.reason === "focus-out" ? document.activeElement : details.event.target;
          if (next instanceof Node && boundaryRef?.current?.contains(next)) {
            details.cancel();
            return;
          }
          onDismiss();
        }}
      >
        <PopoverContent
          variant="bare"
          anchor={anchorRef}
          sideOffset={12}
          initialFocus={false}
          finalFocus={false}
          aria-label={label}
        >
          <div ref={dialogRef} style={{ zoom }}>
            {children}
          </div>
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
