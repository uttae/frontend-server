"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { createContext, use, useRef, type ComponentProps } from "react";

import { CloseIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

const DialogCloseDisabledContext = createContext(false);
const DialogCloseLabelContext = createContext<string | null>(null);

type DialogProps = DialogPrimitive.Root.Props & {
  closeDisabled?: boolean;
};

function Dialog({ closeDisabled = false, onOpenChange, ...props }: Readonly<DialogProps>) {
  return (
    <DialogCloseDisabledContext value={closeDisabled}>
      <DialogPrimitive.Root
        onOpenChange={(open, eventDetails) => {
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

function DialogClose({ disabled, ...props }: Readonly<DialogPrimitive.Close.Props>) {
  const closeDisabled = use(DialogCloseDisabledContext);
  return <DialogPrimitive.Close data-slot="dialog-close" disabled={closeDisabled || disabled} {...props} />;
}

const dialogContentVariants = cva(
  "z-50 flex flex-col gap-5 overflow-y-auto overscroll-contain rounded-[12px] bg-fill-elevate p-5 text-text shadow-[0_2px_10px_rgb(31_34_41/0.1)] outline-none transition-[opacity,scale] duration-150 ease-out data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none",
  {
    variants: {
      size: {
        default: "[--dialog-width:353px]",
        sm: "[--dialog-width:384px]",
        md: "[--dialog-width:448px]",
        lg: "[--dialog-width:640px]",
        xl: "[--dialog-width:720px]",
      },
      fixedWidth: {
        false:
          "fixed top-1/2 left-1/2 max-h-[calc(100dvh-2rem)] w-[min(var(--dialog-width),calc(100vw-2.5rem))] -translate-x-1/2 -translate-y-1/2",
        true: "relative m-auto max-h-full w-(--dialog-width) shrink-0",
      },
    },
    defaultVariants: { size: "default", fixedWidth: false },
  },
);

const FIRST_FOCUSABLE_SELECTOR =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

type DialogContentProps = Omit<DialogPrimitive.Popup.Props, "className"> &
  VariantProps<typeof dialogContentVariants> & {
    showCloseButton?: boolean;
    backdropProps?: Pick<DialogPrimitive.Backdrop.Props, "onClick" | "onMouseDown" | "onPointerDown" | "onTouchStart">;
    closeLabel?: string;
    className?: string;
  };

function DialogContent({
  className,
  children,
  size,
  fixedWidth = false,
  showCloseButton = true,
  closeLabel = "닫기",
  backdropProps,
  initialFocus,
  ...props
}: Readonly<DialogContentProps>) {
  const popupRef = useRef<HTMLDivElement>(null);
  const fixedWidthInitialFocus = () => {
    popupRef.current?.querySelector<HTMLElement>(FIRST_FOCUSABLE_SELECTOR)?.focus({ preventScroll: true });
    return false;
  };
  const popup = (
    <DialogPrimitive.Popup
      ref={popupRef}
      data-slot="dialog-content"
      className={cn(dialogContentVariants({ size, fixedWidth }), className)}
      initialFocus={fixedWidth && initialFocus === undefined ? fixedWidthInitialFocus : initialFocus}
      {...props}
    >
      <DialogCloseLabelContext value={showCloseButton ? closeLabel : null}>{children}</DialogCloseLabelContext>
    </DialogPrimitive.Popup>
  );
  return (
    <DialogPrimitive.Portal data-slot="dialog-portal">
      <DialogPrimitive.Backdrop
        {...backdropProps}
        forceRender
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 min-h-dvh bg-black/40 transition-opacity duration-150 ease-out data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none"
      />
      {fixedWidth ? (
        <DialogPrimitive.Viewport
          data-slot="dialog-viewport"
          className="fixed inset-0 z-50 flex overflow-auto px-5 py-4"
        >
          {popup}
        </DialogPrimitive.Viewport>
      ) : (
        popup
      )}
    </DialogPrimitive.Portal>
  );
}

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

function DialogBody({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("-mx-5 -my-1 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-1", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return <div data-slot="dialog-footer" className={cn("flex gap-2 *:min-w-0 *:flex-1", className)} {...props} />;
}

function DialogTitle({
  className,
  ...props
}: Readonly<Omit<DialogPrimitive.Title.Props, "className"> & { className?: string }>) {
  return (
    <DialogPrimitive.Title data-slot="dialog-title" className={cn("text-title-l text-text", className)} {...props} />
  );
}

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
