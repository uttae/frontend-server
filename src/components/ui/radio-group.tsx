import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { RadioButtonIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

type RadioGroupProps = Omit<RadioGroupPrimitive.Props, "className"> & { className?: string };
type RadioGroupItemProps = Omit<RadioPrimitive.Root.Props, "className"> & { className?: string };

function RadioGroup({ className, ...props }: Readonly<RadioGroupProps>) {
  return <RadioGroupPrimitive data-slot="radio-group" className={cn("flex flex-col", className)} {...props} />;
}

function RadioGroupItem({ className, ...props }: Readonly<RadioGroupItemProps>) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer rounded-full text-border select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-checked:text-[var(--blue-50)] aria-disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      <RadioButtonIcon size={24} className="size-[24px]" />
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="absolute inset-0 m-auto size-[10px] rounded-full bg-primary"
      />
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupItem };
