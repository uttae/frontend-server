import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva("group/alert flex border text-left", {
  variants: {
    tone: {
      neutral: "border-border-subtle bg-fill-subtle text-text",
      brand: "border-[var(--blue-300)] bg-[var(--blue-50)] text-primary",
      warning: "border-status-cautionary bg-fill-subtle text-text",
    },
    size: {
      lg: "rounded-xl px-4 py-3 text-body-m-regular mobile:text-body-s-regular",
      md: "rounded-md p-3 text-body-s-regular",
    },
    orientation: {
      vertical: "flex-col gap-1",
      horizontal: "items-center gap-2",
    },
  },
  defaultVariants: { tone: "neutral", size: "md", orientation: "vertical" },
});

function Alert({
  className,
  tone = "neutral",
  size = "md",
  orientation = "vertical",
  ...props
}: Readonly<ComponentProps<"div"> & VariantProps<typeof alertVariants>>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      {...props}
      data-size={size}
      data-orientation={orientation}
      className={cn(alertVariants({ tone, size, orientation }), className)}
    />
  );
}

function AlertTitle({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "min-w-0 group-data-[size=lg]/alert:text-body-m-emphasis group-data-[size=lg]/alert:mobile:text-body-s-emphasis",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="alert-description"
      className={cn("min-w-0 text-text-subtle", className)}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="alert-action"
      className={cn(
        "flex group-data-[orientation=horizontal]/alert:shrink-0 group-data-[orientation=vertical]/alert:pt-1",
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
