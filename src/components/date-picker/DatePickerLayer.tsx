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

export function DatePickerLayer({
  placement,
  label,
  onDismiss,
  onEscape,
  children,
}: Readonly<{
  placement: DatePickerPlacement;
  label: string;

  onDismiss: () => void;
  onEscape: () => void;
  children: ReactNode;
}>) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const [opener] = useState(() => document.activeElement);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      const active = document.activeElement;
      const focusWasInside = !active || active === document.body || dialog?.contains(active);
      if (focusWasInside && opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [opener]);

  if (placement.presentation === "anchored") {
    const { anchor, boundaryRef, sideOffset } = placement;
    return (
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
        else onDismiss();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          forceRender
          className="fixed inset-0 z-50 min-h-dvh bg-black/40 supports-[-webkit-touch-callout:none]:absolute"
        />

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
