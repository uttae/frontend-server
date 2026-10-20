"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { DATE_PICKER_WIDTH } from "./DatePicker";

export type DatePickerPresentation = "anchored" | "popup";

/**
 * 달력 표시 방식 — `anchored`는 `relative` 입력 칸 아래에 붙고, `popup`은 화면 가운데에 띄운다.
 * 모바일과 스크롤되는 모달 안에서는 `popup`을 쓴다 (Figma Date Picker Usage).
 * `anchored`는 입력 칸 폭에 맞춰 달력 전체를 같은 비율로 줄이거나 늘린다.
 * `popup`은 가로 최소 300px이고, 화면보다 높으면(6주짜리 달·가로 모드) 달력 안에서 세로로 스크롤한다.
 */
export function DatePickerLayer({
  presentation,
  boundaryRef,
  label,
  onDismiss,
  onEscape,
  children,
}: Readonly<{
  presentation: DatePickerPresentation;
  /** `anchored`에서 바깥 클릭 판정 범위 — 입력 칸과 레이어를 함께 감싼 요소 */
  boundaryRef?: RefObject<HTMLElement | null>;
  label: string;
  /** 바깥 클릭·키보드로 레이어를 벗어날 때 */
  onDismiss: () => void;
  onEscape: () => void;
  children: ReactNode;
}>) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

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

  // 첫 페인트 전에 입력 칸 폭을 재서 달력 비율을 맞춘다
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (presentation !== "anchored" || !dialog) return;
    const fit = () => setZoom(dialog.clientWidth / DATE_PICKER_WIDTH);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(dialog);
    return () => observer.disconnect();
  }, [presentation]);

  useEffect(() => {
    if (presentation !== "anchored") return;
    function handlePointerDown(event: PointerEvent) {
      if (!boundaryRef?.current?.contains(event.target as Node)) onDismissRef.current();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [presentation, boundaryRef]);

  const dialog = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={label}
      aria-modal={presentation === "popup" || undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          // 바깥 모달(SettingsDialog)의 Escape 처리까지 닫히지 않도록 막는다
          event.preventDefault();
          event.stopPropagation();
          onEscape();
          return;
        }
        if (event.key !== "Tab" || presentation !== "popup") return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]'),
        ].filter((node) => node.tabIndex >= 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onBlur={(event) => {
        // 키보드로 레이어 밖 요소에 포커스가 가면 닫는다 (마우스는 바깥 클릭 처리)
        if (presentation !== "anchored") return;
        const next = event.relatedTarget;
        if (next && !boundaryRef?.current?.contains(next)) onDismiss();
      }}
      className={
        presentation === "anchored"
          ? "absolute inset-x-0 top-full z-30 mt-3"
          : "max-h-full w-full min-w-[300px] max-w-[353px] overflow-y-auto overscroll-contain rounded-[12px]"
      }
    >
      {presentation === "anchored" ? <div style={{ zoom }}>{children}</div> : children}
    </div>
  );

  if (presentation === "anchored") return dialog;

  return (
    <div
      role="presentation"
      // 화면 폭이 300px+여백보다 좁으면 가운데 정렬이 양옆을 자르지 않게 왼쪽부터 놓고 가로로 스크롤한다
      className="fixed inset-0 z-[220] flex items-center justify-center-safe overflow-x-auto bg-black/40 p-4"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      {dialog}
    </div>
  );
}
