"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { cva, type VariantProps } from "class-variance-authority";
import { createContext, use, type ComponentProps, type TouchEvent } from "react";

import { CloseIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

const SWIPE_IGNORE_TARGETS =
  "button, input, textarea, select, a, label, [role='button'], [role='checkbox'], [role='switch'], [role='radio'], [contenteditable='true']";

function ignoreSwipeOnControl(event: TouchEvent<HTMLDivElement>) {
  if (!(event.target instanceof Element)) return;
  event.target.closest(SWIPE_IGNORE_TARGETS)?.setAttribute("data-base-ui-swipe-ignore", "");
}

const DrawerCloseDisabledContext = createContext(false);
const DrawerCloseLabelContext = createContext("닫기");

type DrawerProps = Omit<
  DrawerPrimitive.Root.Props,
  "swipeDirection" | "snapPoints" | "snapPoint" | "defaultSnapPoint" | "onSnapPointChange" | "snapToSequentialPoints"
> & {
  closeDisabled?: boolean;
};

function Drawer({ closeDisabled = false, onOpenChange, ...props }: Readonly<DrawerProps>) {
  return (
    <DrawerCloseDisabledContext value={closeDisabled}>
      <DrawerPrimitive.Root
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
    </DrawerCloseDisabledContext>
  );
}

function DrawerTrigger(props: Readonly<DrawerPrimitive.Trigger.Props>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerClose({ disabled, ...props }: Readonly<DrawerPrimitive.Close.Props>) {
  const closeDisabled = use(DrawerCloseDisabledContext);
  return <DrawerPrimitive.Close data-slot="drawer-close" disabled={closeDisabled || disabled} {...props} />;
}

const drawerPopupVariants = cva(
  "relative flex w-full flex-col rounded-t-[20px] bg-fill-elevate pb-[max(12px,env(safe-area-inset-bottom))] text-text outline-hidden [transform:translateY(var(--drawer-swipe-movement-y,0px))] transition-transform duration-200 ease-[ease] after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-12 after:bg-fill-elevate data-swiping:select-none data-swiping:duration-0 data-starting-style:[transform:translateY(calc(100%+2px))] data-ending-style:[transform:translateY(calc(100%+2px))] data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*200ms)] data-ending-style:data-swiping:duration-[calc(var(--drawer-swipe-strength,1)*200ms)] motion-reduce:transition-none",
  {
    variants: {
      size: {
        auto: "max-h-[90dvh]",
        half: "h-[50dvh]",
        belowNav: "h-[calc(100dvh-68px)]",
        belowSafeArea: "h-[calc(100dvh-env(safe-area-inset-top,0px)-12px)]",
      },
    },
    defaultVariants: { size: "auto" },
  },
);

type DrawerContentProps = Omit<DrawerPrimitive.Popup.Props, "className"> &
  VariantProps<typeof drawerPopupVariants> & {
    closeLabel?: string;
    className?: string;
  };

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
      <DrawerPrimitive.Backdrop
        forceRender
        data-slot="drawer-overlay"
        className="fixed inset-0 z-50 min-h-dvh bg-[var(--gray-950)]/20 opacity-[calc(1-var(--drawer-swipe-progress,0))] transition-opacity duration-200 ease-[ease] data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*200ms)] data-ending-style:data-swiping:duration-[calc(var(--drawer-swipe-strength,1)*200ms)] motion-reduce:transition-none"
      />
      <DrawerPrimitive.Viewport data-slot="drawer-viewport" className="fixed inset-0 z-50 flex flex-col justify-end">
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          data-base-ui-swipe-ignore={closeDisabled ? "" : undefined}
          onTouchStartCapture={(event) => {
            ignoreSwipeOnControl(event);
            onTouchStartCapture?.(event);
          }}
          className={cn(drawerPopupVariants({ size }), className)}
          {...props}
        >
          <div aria-hidden data-slot="drawer-handle" className="flex shrink-0 justify-center pt-3 pb-1">
            <span className="h-1 w-9 rounded-full bg-border-subtle" />
          </div>
          <DrawerPrimitive.Content className="flex min-h-0 flex-1 flex-col gap-5">
            <DrawerCloseLabelContext value={closeLabel}>{children}</DrawerCloseLabelContext>
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  );
}

function DrawerHeader({ className, children, ...props }: Readonly<ComponentProps<"div">>) {
  const closeLabel = use(DrawerCloseLabelContext);
  const closeDisabled = use(DrawerCloseDisabledContext);
  return (
    <div
      data-slot="drawer-header"
      className={cn("grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-y-1 px-5 pt-2", className)}
      {...props}
    >
      {children}
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

function DrawerTitle({
  className,
  ...props
}: Readonly<Omit<DrawerPrimitive.Title.Props, "className"> & { className?: string }>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("truncate text-title-l text-text", className)}
      {...props}
    />
  );
}

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

function DrawerBody({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="drawer-body"
      className={cn("-my-1 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-1", className)}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("flex shrink-0 gap-2 px-4 py-3 *:min-w-0 *:flex-1", className)}
      {...props}
    />
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
