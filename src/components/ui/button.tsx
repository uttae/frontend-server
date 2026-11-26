"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import { useId } from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap select-none transition-colors duration-120 ease-out not-data-disabled:cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none data-disabled:not-aria-busy:text-text-disabled [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        solid: "",
        weak: "",
        outline: "border",
        text: "",
      },
      tone: {
        neutral: "",
        brand: "",
        critical: "",
      },
      size: {
        lg: "min-h-14 rounded-[12px] px-5.5 text-label-xl-emphasis has-data-[icon=inline-start]:ps-4 has-data-[icon=inline-end]:pe-4 [&_svg:not([class*='size-'])]:size-[24px]",
        md: "min-h-12 rounded-md px-5 text-label-l-emphasis has-data-[icon=inline-start]:ps-3.5 has-data-[icon=inline-end]:pe-3.5 [&_svg:not([class*='size-'])]:size-[20px]",
        sm: "min-h-9 rounded-md px-4 text-label-m-emphasis has-data-[icon=inline-start]:ps-2.5 has-data-[icon=inline-end]:pe-2.5 [&_svg:not([class*='size-'])]:size-[16px]",
        xs: "min-h-8 rounded-md px-3.5 text-label-m-emphasis has-data-[icon=inline-start]:ps-2 has-data-[icon=inline-end]:pe-2 [&_svg:not([class*='size-'])]:size-[16px]",
      },
    },
    compoundVariants: [
      { variant: ["solid", "weak", "outline"], className: "data-disabled:not-aria-busy:bg-fill" },
      {
        variant: "solid",
        tone: "neutral",
        className:
          "bg-[var(--gray-800)] text-text-inverse not-data-disabled:hover:bg-[var(--gray-700)] not-data-disabled:active:bg-[var(--gray-900)] aria-busy:bg-[var(--gray-700)]",
      },
      {
        variant: "solid",
        tone: "brand",
        className:
          "bg-primary text-text-inverse not-data-disabled:hover:bg-primary-strong not-data-disabled:active:bg-[var(--blue-950)] aria-busy:bg-primary-strong",
      },
      {
        variant: "solid",
        tone: "critical",
        className:
          "bg-status-negative text-text-inverse not-data-disabled:hover:bg-[var(--red-800)] not-data-disabled:active:bg-[var(--red-900)] aria-busy:bg-[var(--red-800)]",
      },
      {
        variant: "weak",
        tone: "neutral",
        className:
          "bg-fill text-text not-data-disabled:hover:bg-fill-strong not-data-disabled:active:bg-[var(--gray-300)] aria-busy:bg-fill-strong",
      },
      {
        variant: "outline",
        tone: "brand",
        className:
          "border-border bg-fill-subtle text-primary-strong not-data-disabled:hover:border-border-hover not-data-disabled:hover:bg-fill not-data-disabled:active:border-border not-data-disabled:active:bg-fill-strong aria-busy:bg-fill",
      },
      {
        variant: "outline",
        tone: "neutral",
        className:
          "border-border bg-fill-subtle text-text not-data-disabled:hover:border-border-hover not-data-disabled:hover:bg-fill not-data-disabled:active:border-border not-data-disabled:active:bg-fill-strong aria-busy:bg-fill",
      },
      {
        variant: "text",
        tone: "neutral",
        className: "text-text-subtle not-data-disabled:active:bg-fill",
      },
    ],
    defaultVariants: { variant: "solid", tone: "neutral", size: "md" },
  },
);

type ButtonTypeProps =
  | { variant?: "solid"; tone?: "neutral" | "brand" | "critical" }
  | { variant: "weak"; tone?: "neutral" }
  | { variant: "outline"; tone?: "neutral" | "brand" }
  | { variant: "text"; tone?: "neutral" };

type ButtonProps = Omit<ButtonPrimitive.Props, "className"> &
  ButtonTypeProps & {
    className?: string;
    size?: "lg" | "md" | "sm" | "xs";
    loading?: boolean;
    loadingLabel?: string;
  };

function Button({
  className,
  variant = "solid",
  tone = "neutral",
  size = "md",
  loading = false,
  loadingLabel = "처리 중",
  disabled,
  focusableWhenDisabled,
  children,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: Readonly<ButtonProps>) {
  const loadingLabelId = useId();

  return (
    <ButtonPrimitive
      data-slot="button"
      disabled={disabled || loading}
      focusableWhenDisabled={focusableWhenDisabled || loading}
      aria-busy={loading || undefined}
      aria-labelledby={loading ? loadingLabelId : ariaLabelledBy}
      className={cn(buttonVariants({ variant, tone, size }), className)}
      {...props}
    >
      <span data-slot="button-content" className="contents group-aria-busy/button:invisible">
        {children}
      </span>
      {loading && (
        <>
          <span id={loadingLabelId} className="sr-only">
            {loadingLabel}
          </span>
          <Spinner
            aria-hidden
            size={size === "lg" ? 24 : 20}
            variant={variant === "solid" ? "inverse" : "default"}
            className="absolute inset-0"
          />
        </>
      )}
    </ButtonPrimitive>
  );
}

export { Button };
