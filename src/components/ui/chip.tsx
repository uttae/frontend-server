import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { CloseIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

const chipVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full whitespace-nowrap transition-colors duration-120 ease-out enabled:cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none [&_svg:not([class*='size-'])]:size-[16px] [&_svg_*]:[stroke-width:1.5]",
  {
    variants: {
      variant: {
        solid:
          "bg-fill text-text enabled:active:bg-fill-strong aria-pressed:bg-primary aria-pressed:text-text-inverse aria-pressed:enabled:active:bg-primary-strong data-disabled:bg-fill data-disabled:text-text-disabled",
        outline:
          "border border-border bg-fill-subtle text-text enabled:active:bg-fill-strong aria-pressed:border-primary-strong aria-pressed:text-primary-strong aria-pressed:enabled:active:bg-[var(--blue-50)] data-disabled:border-border data-disabled:text-text-disabled aria-pressed:data-disabled:bg-fill",
      },
      size: {
        lg: "min-h-11 px-4 text-label-l-emphasis data-disabled:text-label-l-regular",
        md: "min-h-9 px-4 text-label-m-emphasis data-disabled:text-label-m-regular",
        sm: "min-h-8 px-3 text-label-m-emphasis data-disabled:text-label-m-regular",
      },
      selected: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      { variant: "solid", selected: true, className: "bg-primary text-text-inverse" },
      { variant: "outline", selected: true, className: "border-primary-strong text-primary-strong" },
    ],
    defaultVariants: { variant: "solid", size: "lg", selected: false },
  },
);

function Chip({
  className,
  variant = "solid",
  size = "lg",
  selected = false,
  render,
  ...props
}: Readonly<useRender.ComponentProps<"span"> & VariantProps<typeof chipVariants>>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">({ className: cn(chipVariants({ variant, size, selected }), className) }, props),
    render,
    state: { slot: "chip", variant, size, selected: Boolean(selected) },
  });
}

function ChipRemove({ className, ...props }: Readonly<ComponentProps<"button">>) {
  return (
    <button
      type="button"
      data-slot="chip-remove"
      className={cn(
        "-mx-1.5 -my-3.5 grid h-11 w-7 shrink-0 cursor-pointer place-items-center focus-visible:outline-2 focus-visible:outline-primary",
        className,
      )}
      {...props}
    >
      <CloseIcon size={16} />
    </button>
  );
}

export { Chip, ChipRemove };
