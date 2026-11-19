import { Select as SelectPrimitive } from "@base-ui/react/select";

import { CheckIcon, ChevronDownIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

function Select<Value, Multiple extends boolean | undefined = false>({
  modal = false,
  ...props
}: Readonly<SelectPrimitive.Root.Props<Value, Multiple>>) {
  return <SelectPrimitive.Root modal={modal} {...props} />;
}

type SelectTriggerProps = Omit<SelectPrimitive.Trigger.Props, "className"> & { className?: string };

function SelectTrigger({ className, children, ...props }: Readonly<SelectTriggerProps>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "group/select-trigger flex min-h-12 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md border border-border bg-fill-subtle pl-3.5 pr-2.5 text-left text-body-m-regular text-text transition-colors select-none not-data-disabled:not-aria-invalid:not-data-popup-open:hover:border-border-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-invalid:border-status-negative data-placeholder:not-data-disabled:text-text-subtle data-popup-open:not-aria-invalid:border-primary data-disabled:cursor-not-allowed data-disabled:bg-fill data-disabled:text-text-disabled",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        data-slot="select-icon"
        className="grid w-8 shrink-0 place-items-center self-stretch text-icon-subtle transition-transform duration-120 ease-out group-data-disabled/select-trigger:text-icon-disabled data-popup-open:rotate-180 motion-reduce:transition-none"
      >
        <ChevronDownIcon size={20} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

type SelectValueProps = Omit<SelectPrimitive.Value.Props, "className"> & { className?: string };

function SelectValue({ className, ...props }: Readonly<SelectValueProps>) {
  return (
    <SelectPrimitive.Value data-slot="select-value" className={cn("min-w-0 flex-1 truncate", className)} {...props} />
  );
}

type SelectContentProps = Omit<SelectPrimitive.Popup.Props, "className"> & { className?: string } & Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >;

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: Readonly<SelectContentProps>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "max-h-[min(15rem,var(--available-height))] w-(--anchor-width) origin-(--transform-origin) overflow-y-auto overscroll-contain rounded-md border border-border bg-fill-elevate shadow-[0_2px_10px_rgba(31,34,41,0.10)] outline-hidden transition-[opacity,scale] duration-100 ease-out data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0 motion-reduce:transition-none",
            className,
          )}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

type SelectItemProps = Omit<SelectPrimitive.Item.Props, "className"> & { className?: string };

function SelectItem({ className, children, ...props }: Readonly<SelectItemProps>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "flex min-h-14 w-full cursor-pointer items-center border-b-[0.5px] border-border-subtle pl-3.5 text-body-m-regular text-text outline-hidden select-none last:border-b-0 data-highlighted:bg-fill data-disabled:cursor-not-allowed data-disabled:text-text-disabled",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="min-w-0 flex-1 pl-0.5 pr-4 break-words">{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="grid size-12 shrink-0 place-items-center text-primary">
        <CheckIcon size={16} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
