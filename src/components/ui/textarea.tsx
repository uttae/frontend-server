import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: Readonly<ComponentProps<"textarea">>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "block h-24 max-h-[218px] min-h-24 w-full min-w-0 resize-y overflow-y-auto rounded-md border border-border bg-fill-subtle py-3 pr-7 pl-3.5 text-body-m-regular text-text transition-colors [scrollbar-color:var(--gray-400)_transparent] [scrollbar-width:thin] placeholder:text-text-subtle focus:border-primary focus:outline-hidden read-only:bg-fill read-only:text-[var(--gray-800)] disabled:cursor-not-allowed disabled:bg-fill disabled:text-text-disabled disabled:placeholder:text-text-disabled aria-invalid:border-status-negative",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
