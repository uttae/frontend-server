import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit max-w-full shrink-0 items-center gap-1 overflow-hidden rounded-[4px] whitespace-nowrap",
  {
    variants: {
      variant: {
        weak: "",
        solid: "",
        outline: "border",
      },
      tone: {
        neutral: "",
        brand: "",
        informative: "",
        positive: "",
        warning: "",
        critical: "",
      },
      size: {
        lg: "min-h-6 px-2 text-label-s-regular [&>svg]:size-[14px]",
        md: "min-h-5 px-1.5 text-label-xs-regular [&>svg]:size-[12px]",
      },
    },
    compoundVariants: [
      { variant: "weak", tone: "neutral", className: "bg-fill text-text" },
      { variant: "weak", tone: "brand", className: "bg-[var(--blue-50)] text-primary-strong" },
      { variant: "weak", tone: "informative", className: "bg-fill text-primary-strong" },
      {
        variant: "weak",
        tone: "positive",
        className: "bg-[var(--lime-100)] text-[var(--green-700)] [&>svg]:text-[var(--green-800)]",
      },
      {
        variant: "weak",
        tone: "warning",
        className: "bg-[var(--orange-100)] text-[var(--orange-700)] [&>svg]:text-[var(--orange-800)]",
      },
      { variant: "weak", tone: "critical", className: "bg-[var(--red-100)] text-[var(--red-800)]" },
      { variant: "solid", tone: "neutral", className: "bg-[var(--gray-800)] text-text-inverse" },
      { variant: "solid", tone: "brand", className: "bg-primary-strong text-text-inverse" },
      { variant: "solid", tone: "informative", className: "bg-fill text-primary-strong" },
      { variant: "solid", tone: "positive", className: "bg-[var(--green-700)] text-text-inverse" },
      { variant: "solid", tone: "warning", className: "bg-[var(--orange-700)] text-text-inverse" },
      { variant: "solid", tone: "critical", className: "bg-[var(--red-800)] text-text-inverse" },
      { variant: "outline", tone: "neutral", className: "border-text text-text" },
      { variant: "outline", tone: "brand", className: "border-primary-strong text-primary-strong" },
      { variant: "outline", tone: "informative", className: "border-border text-primary-strong" },
      {
        variant: "outline",
        tone: "positive",
        className: "border-[var(--green-700)] text-[var(--green-700)] [&>svg]:text-[var(--green-800)]",
      },
      {
        variant: "outline",
        tone: "warning",
        className: "border-[var(--orange-700)] text-[var(--orange-700)] [&>svg]:text-[var(--orange-800)]",
      },
      { variant: "outline", tone: "critical", className: "border-[var(--red-800)] text-[var(--red-800)]" },
    ],
    defaultVariants: { variant: "weak", tone: "neutral", size: "lg" },
  },
);

function Badge({
  className,
  variant = "weak",
  tone = "neutral",
  size = "lg",
  render,
  ...props
}: Readonly<useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">({ className: cn(badgeVariants({ variant, tone, size }), className) }, props),
    render,
    state: { slot: "badge", variant, tone, size },
  });
}

export { Badge };
