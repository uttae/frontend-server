import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const avatarVariants = cva("relative flex shrink-0 select-none items-center justify-center overflow-hidden", {
  variants: {
    size: {
      24: "size-[24px] text-body-xs-regular [&_svg]:size-[12px]",
      28: "size-[28px] text-label-xs-regular [&_svg]:size-[16px]",
      32: "size-[32px] text-label-m-regular mobile:text-label-xs-regular [&_svg]:size-[20px]",
      36: "size-[36px] text-label-l-regular [&_svg]:size-[20px]",
      40: "size-[40px] text-label-xl-regular [&_svg]:size-[24px]",
      56: "size-[56px] text-heading-s [&_svg]:size-[32px]",
    },
    shape: {
      circle: "rounded-full",
      rounded: "rounded-xl",
    },
    tone: {
      primary: "bg-primary-subtle text-primary",
      neutral: "bg-fill text-text-subtle",
      placeholder: "bg-fill-strong text-text-subtle",
      icon: "bg-[var(--gray-300)] text-icon-disabled *:data-[slot=avatar-fallback]:bg-fill-strong",
      elevate: "bg-fill-elevate",
    },
    ring: {
      none: "",
      online: "border-2 border-primary bg-fill-elevate",
      offline:
        "border-2 border-border in-data-[slot=avatar-group]:grayscale in-data-[slot=avatar-group]:brightness-110 in-data-[slot=avatar-group]:contrast-75",
      subtle: "ring-1 ring-border-subtle shadow-[0_1px_4px_rgba(31,34,41,0.08)]",
      default: "ring-1 ring-border",
      cutout: "border-[1.5px] border-fill-elevate",
    },
  },
  compoundVariants: [{ shape: "rounded", size: [24, 28], className: "rounded-lg" }],
  defaultVariants: { size: 36, shape: "circle", tone: "placeholder", ring: "none" },
});

type AvatarProps = Omit<AvatarPrimitive.Root.Props, "className"> &
  VariantProps<typeof avatarVariants> & { className?: string };

function Avatar({ className, size, shape, tone, ring, ...props }: Readonly<AvatarProps>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(avatarVariants({ size, shape, tone, ring }), className)}
      {...props}
    />
  );
}

type AvatarImageProps = Omit<AvatarPrimitive.Image.Props, "className" | "keepMounted"> & { className?: string };

function AvatarImage({ className, ...props }: Readonly<AvatarImageProps>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      referrerPolicy="no-referrer"
      keepMounted
      className={cn("absolute inset-0 size-full bg-inherit object-cover data-error:hidden", className)}
      {...props}
    />
  );
}

type AvatarFallbackProps = Omit<AvatarPrimitive.Fallback.Props, "className" | "delay"> & { className?: string };

function AvatarFallback({ className, ...props }: Readonly<AvatarFallbackProps>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn("flex size-full items-center justify-center", className)}
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: Readonly<ComponentProps<"span">>) {
  return (
    <span
      data-slot="avatar-group"
      className={cn("isolate flex items-center *:not-first:-ml-3", className)}
      {...props}
    />
  );
}

function AvatarGroupCount({ className, ...props }: Readonly<ComponentProps<"span">>) {
  return (
    <span
      data-slot="avatar-group-count"
      className={cn("flex shrink-0 items-center text-label-l-emphasis text-text-subtle [&_svg]:text-icon-subtle", className)}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage };
