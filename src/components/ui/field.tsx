import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function Field({ className, ...props }: Readonly<ComponentProps<"div">>) {
  return (
    <div data-slot="field" className={cn("group/field flex w-full min-w-0 flex-col gap-1", className)} {...props} />
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

const fieldBoxVariants = cva(
  "flex w-full min-w-0 flex-col gap-0.5 rounded-md border border-border pt-2.75 pr-1.75 pb-1.25 pl-2.75 text-left text-text transition-colors",
  {
    variants: {
      control: {
        input: "bg-fill-subtle focus-within:border-primary has-[[aria-invalid=true]]:border-status-negative",
        trigger:
          "cursor-pointer bg-fill-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-invalid:border-status-negative",
        readOnly: "bg-fill text-text-subtle **:data-[slot=field-box-label]:text-text-subtle",
      },
    },
    defaultVariants: { control: "input" },
  },
);

function FieldBox({
  className,
  control,
  ...props
}: Readonly<ComponentProps<"div"> & VariantProps<typeof fieldBoxVariants>>) {
  return <div data-slot="field-box" className={cn(fieldBoxVariants({ control }), className)} {...props} />;
}

function FieldBoxLabel({ className, render, ...props }: Readonly<useRender.ComponentProps<"span">>) {
  return useRender({
    defaultTagName: "span",
    render,
    props: mergeProps<"span">({ className: cn("min-w-0 pr-2 pl-1 text-label-l-regular text-text", className) }, props),
    state: { slot: "field-box-label" },
  });
}

function FieldBoxRow({ className, ...props }: Readonly<ComponentProps<"span">>) {
  return (
    <span
      data-slot="field-box-row"
      className={cn("flex min-h-8 w-full min-w-0 items-center gap-1 text-body-m-regular", className)}
      {...props}
    />
  );
}

function FieldBoxInput({ className, ...props }: Readonly<ComponentProps<"input">>) {
  return (
    <input
      data-slot="field-box-input"
      className={cn(
        "min-w-0 flex-1 bg-transparent px-1 text-text placeholder:text-text-subtle focus:outline-hidden",
        className,
      )}
      {...props}
    />
  );
}

export {
  Field,
  FieldBox,
  FieldBoxInput,
  FieldBoxLabel,
  FieldBoxRow,
  fieldBoxVariants,
  FieldHeader,
  FieldLabel,
  FieldSuffix,
  FieldFooter,
  FieldDescription,
  FieldError,
  FieldCount,
};
