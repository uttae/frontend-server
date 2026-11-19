"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { useRef, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AlertDialogProps = AlertDialogPrimitive.Root.Props & {
  closeDisabled?: boolean;
};

function AlertDialog({ closeDisabled = false, onOpenChange, ...props }: Readonly<AlertDialogProps>) {
  return (
    <AlertDialogPrimitive.Root
      data-slot="alert-dialog"
      onOpenChange={(open, eventDetails) => {
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

function AlertDialogTrigger(props: Readonly<AlertDialogPrimitive.Trigger.Props>) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

type BackdropEventProps = Pick<AlertDialogPrimitive.Backdrop.Props, "onClick" | "onMouseDown" | "onPointerDown" | "onTouchStart">;

function AlertDialogOverlay({ closeLabel, backdropProps }: Readonly<{ closeLabel?: string; backdropProps?: BackdropEventProps }>) {
  return (
    <AlertDialogPrimitive.Backdrop
      {...backdropProps}
      forceRender
      data-slot="alert-dialog-overlay"
      className="fixed inset-0 z-50 min-h-dvh bg-black/40 transition-opacity duration-100 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none supports-[-webkit-touch-callout:none]:absolute"
    >
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
  className?: string;
  backdropCloseLabel?: string;
  backdropProps?: BackdropEventProps;
  "aria-label"?: string;
};

function AlertDialogContent({ className, backdropCloseLabel, backdropProps, initialFocus, ...props }: Readonly<AlertDialogContentProps>) {
  const popupRef = useRef<HTMLDivElement>(null);
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal">
      <AlertDialogOverlay closeLabel={backdropCloseLabel} backdropProps={backdropProps} />
      <AlertDialogPrimitive.Popup
        ref={popupRef}
        data-slot="alert-dialog-content"
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

function AlertDialogHeader({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-1 text-center", className)}
      {...props}
    />
  );
}

function AlertDialogTitle({ className, ...props }: Readonly<AlertDialogPrimitive.Title.Props>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-title-l text-text", className)}
      {...props}
    />
  );
}

function AlertDialogDescription({ className, ...props }: Readonly<AlertDialogPrimitive.Description.Props>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-body-l-regular break-keep wrap-break-word whitespace-pre-line text-text-subtle", className)}
      {...props}
    />
  );
}

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
  tone?: "neutral" | "critical";
};

function AlertDialogAction({ tone = "neutral", ...props }: Readonly<AlertDialogActionProps>) {
  return <Button data-slot="alert-dialog-action" {...props} variant="solid" size="md" tone={tone} />;
}

type AlertDialogCancelProps = Omit<AlertDialogPrimitive.Close.Props, "className" | "render"> & {
  className?: string;
};

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
