import { Input as InputPrimitive } from "@base-ui/react/input";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: Readonly<ComponentProps<"input">>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "min-h-12 w-full min-w-0 rounded-md border border-border bg-fill-subtle px-3.5 text-body-m-regular text-text transition-colors placeholder:text-text-subtle focus:border-primary focus:outline-hidden read-only:bg-fill read-only:text-[var(--gray-800)] disabled:cursor-not-allowed disabled:bg-fill disabled:text-text-disabled disabled:placeholder:text-text-disabled aria-invalid:border-status-negative",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
