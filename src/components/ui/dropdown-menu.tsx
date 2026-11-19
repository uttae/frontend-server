import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function DropdownMenu({ modal = false, ...props }: Readonly<MenuPrimitive.Root.Props>) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" modal={modal} {...props} />;
}

function DropdownMenuTrigger(props: Readonly<MenuPrimitive.Trigger.Props>) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

type DropdownMenuContentProps = Omit<MenuPrimitive.Popup.Props, "className"> &
  Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset"> & {
    className?: string;
    size?: "sm" | "lg";
  };

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  size = "sm",
  className,
  ...props
}: Readonly<DropdownMenuContentProps>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          data-size={size}
          className={cn(
            "group/dropdown-menu flex w-max max-w-(--available-width) min-w-40 max-h-(--available-height) flex-col overflow-x-hidden overflow-y-auto rounded-[12px] bg-fill-elevate shadow-[0_2px_10px_#1f22291a] outline-none",
            "origin-(--transform-origin) transition-[opacity,scale] duration-150 ease-out data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 data-instant:transition-none motion-reduce:transition-none",
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

const dropdownMenuItemVariants = cva(
  "flex w-full min-w-0 cursor-pointer items-center gap-2 px-4 py-3.5 text-left text-label-m-regular text-text shadow-[inset_0_-0.5px_0_var(--color-border-subtle)] select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary data-highlighted:bg-fill data-disabled:cursor-not-allowed data-disabled:text-text-disabled group-data-[size=lg]/dropdown-menu:px-5 group-data-[size=lg]/dropdown-menu:text-label-l-regular [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-icon [&_svg:not([class*='size-'])]:size-5 data-disabled:[&_svg]:text-icon-disabled",
  {
    variants: {
      variant: {
        default: "",
        destructive: "text-[var(--red-800)] [&_svg]:text-status-negative",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type DropdownMenuItemProps = Omit<MenuPrimitive.Item.Props, "className"> &
  VariantProps<typeof dropdownMenuItemVariants> & { className?: string };

function DropdownMenuItem({ className, variant = "default", ...props }: Readonly<DropdownMenuItemProps>) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      className={cn(dropdownMenuItemVariants({ variant }), className)}
      {...props}
    />
  );
}

type DropdownMenuLinkItemProps = Omit<MenuPrimitive.LinkItem.Props, "className"> &
  VariantProps<typeof dropdownMenuItemVariants> & { className?: string };

function DropdownMenuLinkItem({
  className,
  variant = "default",
  closeOnClick = true,
  ...props
}: Readonly<DropdownMenuLinkItemProps>) {
  return (
    <MenuPrimitive.LinkItem
      data-slot="dropdown-menu-link-item"
      data-variant={variant}
      closeOnClick={closeOnClick}
      className={cn(dropdownMenuItemVariants({ variant }), className)}
      {...props}
    />
  );
}

function DropdownMenuHeader({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="dropdown-menu-header"
      className={cn(
        "flex min-w-0 flex-col gap-1 py-5 pr-4 pl-5 shadow-[inset_0_-0.5px_0_var(--color-border-subtle)]",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuHeaderTitle({ className, ...props }: Readonly<ComponentProps<"p">>) {
  return (
    <p
      data-slot="dropdown-menu-header-title"
      className={cn("truncate text-label-xl-emphasis text-text", className)}
      {...props}
    />
  );
}

function DropdownMenuHeaderDescription({ className, ...props }: Readonly<ComponentProps<"p">>) {
  return (
    <p
      data-slot="dropdown-menu-header-description"
      className={cn("truncate text-body-s-regular text-text-subtle", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuHeader,
  DropdownMenuHeaderTitle,
  DropdownMenuHeaderDescription,
};
