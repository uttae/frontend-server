import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { cva } from "class-variance-authority";

import { CheckboxActivatedIcon, CheckboxIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

const CHECKBOX_ICON_SIZE = { md: 24, sm: 20 } as const;

const checkboxIconVariants = cva("", {
  variants: {
    size: {
      md: "size-[24px]",
      sm: "size-[20px]",
    },
  },
});

type CheckboxProps = Omit<CheckboxPrimitive.Root.Props, "className" | "indeterminate"> & {
  size?: keyof typeof CHECKBOX_ICON_SIZE;
  className?: string;
};

function Checkbox({ className, size = "md", ...props }: Readonly<CheckboxProps>) {
  const iconSize = CHECKBOX_ICON_SIZE[size];
  const iconClassName = checkboxIconVariants({ size });
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "group/checkbox relative inline-flex shrink-0 cursor-pointer rounded-sm select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      <CheckboxIcon
        size={iconSize}
        className={cn(iconClassName, "text-border group-aria-checked/checkbox:invisible")}
      />
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="absolute inset-0">
        <CheckboxActivatedIcon size={iconSize} className={cn(iconClassName, "text-primary")} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
