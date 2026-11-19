import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { ProgressIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

const spinnerVariants = cva("inline-flex items-center justify-center", {
  variants: {
    variant: {
      default: "text-icon",
      inverse: "text-icon-inverse",
    },
  },
  defaultVariants: { variant: "default" },
});

const spinnerIconVariants = cva("motion-safe:animate-spin", {
  variants: {
    size: {
      12: "size-[12px]",
      16: "size-[16px]",
      20: "size-[20px]",
      24: "size-[24px]",
      28: "size-[28px]",
      32: "size-[32px]",
    },
  },
});

type SpinnerProps = Omit<ComponentProps<"output">, "children"> &
  VariantProps<typeof spinnerVariants> & {
    size?: 12 | 16 | 20 | 24 | 28 | 32;
  };

function Spinner({ variant, size = 20, className, ...props }: Readonly<SpinnerProps>) {
  return (
    <output
      data-slot="spinner"
      aria-label="불러오는 중"
      className={cn(spinnerVariants({ variant }), className)}
      {...props}
    >
      <ProgressIcon size={size} className={spinnerIconVariants({ size })} />
    </output>
  );
}

export { Spinner };
