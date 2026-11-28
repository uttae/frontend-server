"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

function Popover(props: Readonly<PopoverPrimitive.Root.Props>) {
  return <PopoverPrimitive.Root {...props} />;
}

function PopoverTrigger(props: Readonly<PopoverPrimitive.Trigger.Props>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

const popoverContentVariants = cva(
  "flex origin-(--transform-origin) flex-col outline-hidden transition-[opacity,scale] duration-100 ease-out data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-instant:transition-none motion-reduce:transition-none",
  {
    variants: {
      variant: {
        panel:
          "w-[min(305px,calc(100vw-2rem))] gap-4 rounded-[12px] bg-fill-elevate p-6 text-text shadow-[0_2px_10px_rgba(31,34,41,0.10)]",
        bare: "w-(--anchor-width)",
        modal:
          "w-(--anchor-width) gap-5 rounded-[12px] bg-fill-elevate p-5 text-text shadow-[0_2px_10px_rgb(31_34_41/0.1)]",
      },
    },
    defaultVariants: { variant: "panel" },
  },
);

type PopoverContentProps = Omit<PopoverPrimitive.Popup.Props, "className"> &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "anchor" | "collisionAvoidance"
  > &
  VariantProps<typeof popoverContentVariants> & { className?: string };

function PopoverContent({
  className,
  variant,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 8,
  anchor,
  collisionAvoidance,
  ...props
}: Readonly<PopoverContentProps>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        anchor={anchor}
        collisionAvoidance={collisionAvoidance}
        className="z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(popoverContentVariants({ variant }), className)}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverContent, PopoverTrigger };
