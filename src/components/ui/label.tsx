import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Label({ className, htmlFor, children, ...props }: Readonly<ComponentProps<"label">>) {
  return (
    <label
      htmlFor={htmlFor}
      data-slot="label"
      className={cn("flex items-center gap-0.5 text-label-xs-regular text-text select-none", className)}
      {...props}
    >
      {children}
    </label>
  );
}

export { Label };
