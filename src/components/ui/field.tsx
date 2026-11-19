import type { ComponentProps } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function Field({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="field"
      className={cn("group/field flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  );
}

function FieldHeader({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div
      data-slot="field-header"
      className={cn(
        "flex items-center gap-7.5 *:data-[slot=field-label]:min-w-0 *:data-[slot=field-label]:flex-1",
        className,
      )}
      {...props}
    />
  );
}

function FieldLabel({ className, ...props }: Readonly<ComponentProps<typeof Label>>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "group-has-[[aria-invalid=true]]/field:text-[var(--red-800)] group-has-[:is(input,textarea):disabled:not([aria-invalid=true])]/field:text-text-disabled group-has-[:is(input,textarea)[readonly]:enabled:not([aria-invalid=true])]/field:text-text-subtle",
        className,
      )}
      {...props}
    />
  );
}

function FieldSuffix({ className, ...props }: Readonly<ComponentProps<"span">>) {
  return (
    <span
      data-slot="field-suffix"
      className={cn("shrink-0 text-caption-s-regular text-text-subtle", className)}
      {...props}
    />
  );
}

function FieldFooter({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return <div data-slot="field-footer" className={cn("flex items-center", className)} {...props} />;
}

function FieldDescription({ className, ...props }: Readonly<ComponentProps<"p">>) {
  return (
    <p
      data-slot="field-description"
      className={cn("min-w-0 text-caption-s-regular text-text-subtle", className)}
      {...props}
    />
  );
}

function FieldError({ className, children, ...props }: Readonly<ComponentProps<"p">>) {
  if (!children) return null;
  return (
    <p
      role="alert"
      data-slot="field-error"
      className={cn("min-w-0 text-caption-s-regular text-[var(--red-800)]", className)}
      {...props}
    >
      {children}
    </p>
  );
}

function FieldCount({ className, ...props }: Readonly<ComponentProps<"span">>) {
  return (
    <span
      data-slot="field-count"
      className={cn(
        "ms-auto shrink-0 text-caption-s-regular text-text-subtle group-has-[[aria-invalid=true]]/field:text-[var(--red-800)]",
        className,
      )}
      {...props}
    />
  );
}

export {
  Field,
  FieldHeader,
  FieldLabel,
  FieldSuffix,
  FieldFooter,
  FieldDescription,
  FieldError,
  FieldCount,
};
