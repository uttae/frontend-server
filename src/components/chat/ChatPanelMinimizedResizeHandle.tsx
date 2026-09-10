"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import type { ChatPanelMinimizedSize } from "@/lib/chat/chat-panel-minimized-size";
import { cn } from "@/lib/utils";

type ChatPanelMinimizedResizeHandleProps = {
  size: ChatPanelMinimizedSize;
  onResize: (size: ChatPanelMinimizedSize) => void;
  onResizeEnd: (size: ChatPanelMinimizedSize) => void;
  clampSize: (width: number, height: number) => ChatPanelMinimizedSize;
};

type ResizeAxis = "both" | "width" | "height";

type DragSession = {
  pointerId: number;
  axis: ResizeAxis;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};

function resolveSize(
  session: DragSession,
  clientX: number,
  clientY: number,
  clampSize: (width: number, height: number) => ChatPanelMinimizedSize,
): ChatPanelMinimizedSize {
  const deltaX = session.startX - clientX;
  const deltaY = session.startY - clientY;
  const nextWidth =
    session.axis === "height"
      ? session.startWidth
      : session.startWidth + deltaX;
  const nextHeight =
    session.axis === "width"
      ? session.startHeight
      : session.startHeight + deltaY;

  return clampSize(nextWidth, nextHeight);
}

type ResizeTargetProps = {
  axis: ResizeAxis;
  ariaLabel: string;
  className: string;
  size: ChatPanelMinimizedSize;
  onResize: (size: ChatPanelMinimizedSize) => void;
  onResizeEnd: (size: ChatPanelMinimizedSize) => void;
  clampSize: (width: number, height: number) => ChatPanelMinimizedSize;
  sessionRef: React.MutableRefObject<DragSession | null>;
};

function ResizeTarget({
  axis,
  ariaLabel,
  className,
  size,
  onResize,
  onResizeEnd,
  clampSize,
  sessionRef,
}: ResizeTargetProps) {
  const latest = useRef({ onResize, onResizeEnd, clampSize });
  const cleanupRef = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    latest.current = { onResize, onResizeEnd, clampSize };
  }, [onResize, onResizeEnd, clampSize]);
  useEffect(() => () => cleanupRef.current?.(), []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (sessionRef.current) return;
      sessionRef.current = {
        pointerId: event.pointerId,
        axis,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: size.width,
        startHeight: size.height,
      };

      event.currentTarget.setPointerCapture(event.pointerId);
      const previousUserSelect = document.body.style.userSelect;
      const cleanup = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);
        document.body.style.userSelect = previousUserSelect;
        sessionRef.current = null;
        cleanupRef.current = null;
      };
      function handlePointerMove(move: PointerEvent) {
        const session = sessionRef.current;
        if (!session || move.pointerId !== session.pointerId) return;
        latest.current.onResize(resolveSize(session, move.clientX, move.clientY, latest.current.clampSize));
      }
      function endDrag(end: PointerEvent) {
        const session = sessionRef.current;
        if (!session || end.pointerId !== session.pointerId) return;
        cleanup();
        latest.current.onResizeEnd(resolveSize(session, end.clientX, end.clientY, latest.current.clampSize));
      }
      cleanupRef.current = cleanup;
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    },
    [axis, sessionRef, size.height, size.width],
  );

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      className={className}
    />
  );
}

export function ChatPanelMinimizedResizeHandle({
  size,
  onResize,
  onResizeEnd,
  clampSize,
}: ChatPanelMinimizedResizeHandleProps) {
  const sessionRef = useRef<DragSession | null>(null);

  return (
    <>
      <ResizeTarget
        axis="height"
        ariaLabel="채팅 패널 높이 조절"
        size={size}
        onResize={onResize}
        onResizeEnd={onResizeEnd}
        clampSize={clampSize}
        sessionRef={sessionRef}
        className="absolute left-0 right-0 top-0 z-30 h-1.5 touch-none cursor-ns-resize bg-transparent"
      />
      <ResizeTarget
        axis="width"
        ariaLabel="채팅 패널 너비 조절"
        size={size}
        onResize={onResize}
        onResizeEnd={onResizeEnd}
        clampSize={clampSize}
        sessionRef={sessionRef}
        className="absolute bottom-0 left-0 top-0 z-30 w-1.5 touch-none cursor-ew-resize bg-transparent"
      />
      <ResizeTarget
        axis="both"
        ariaLabel="채팅 패널 크기 조절"
        size={size}
        onResize={onResize}
        onResizeEnd={onResizeEnd}
        clampSize={clampSize}
        sessionRef={sessionRef}
        className={cn(
          "absolute left-0 top-0 z-40 h-5 w-5 touch-none cursor-nwse-resize rounded-tl-2xl bg-transparent",
        )}
      />
    </>
  );
}
