import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import type { ReactNode } from "react";

import { CheckIcon, ChevronDownIcon, SearchIcon } from "@/assets/icons";
import { SearchBar, SearchBarIcon, SearchBarInput } from "@/components/ui/search-bar";
import { cn } from "@/lib/utils";

const Combobox = ComboboxPrimitive.Root;

type StringClassName<P> = Omit<P, "className"> & { className?: string };

function ComboboxLabel({ className, ...props }: Readonly<StringClassName<ComboboxPrimitive.Label.Props>>) {
  return (
    <ComboboxPrimitive.Label
      data-slot="combobox-label"
      className={cn("text-label-xs-regular text-text select-none", className)}
      {...props}
    />
  );
}

function ComboboxTrigger({
  className,
  children,
  ...props
}: Readonly<StringClassName<ComboboxPrimitive.Trigger.Props>>) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn(
        "group/combobox-trigger flex min-h-12 w-full min-w-0 items-center gap-2 rounded-md border border-border bg-fill-subtle pl-3.5 pr-2.5 text-start text-body-m-regular text-text transition-colors not-data-disabled:cursor-pointer focus-visible:outline-2 focus-visible:outline-primary data-placeholder:not-data-disabled:text-text-subtle data-popup-open:border-primary data-disabled:cursor-not-allowed data-disabled:bg-fill data-disabled:text-text-disabled motion-reduce:transition-none",
        className,
      )}
      {...props}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <span
        aria-hidden
        className="grid w-8 shrink-0 place-items-center self-stretch text-icon-subtle group-data-disabled/combobox-trigger:text-icon-disabled"
      >
        <ChevronDownIcon size={20} className="group-data-popup-open/combobox-trigger:rotate-180" />
      </span>
    </ComboboxPrimitive.Trigger>
  );
}

const ComboboxValue = ComboboxPrimitive.Value;

type ComboboxContentProps = StringClassName<ComboboxPrimitive.Popup.Props> &
  Pick<ComboboxPrimitive.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset">;

function ComboboxContent({
  className,
  side = "bottom",
  align = "start",
  sideOffset = 4,
  alignOffset = 0,
  ...props
}: Readonly<ComboboxContentProps>) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        className="z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            "flex max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) flex-col gap-1 outline-hidden transition-opacity duration-150 ease-out data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none",
            className,
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

type ComboboxInputProps = StringClassName<ComboboxPrimitive.Input.Props> & {
  placeholder: string;
  children?: ReactNode;
};

function ComboboxInput({ className, placeholder, children, ...props }: Readonly<ComboboxInputProps>) {
  return (
    <ComboboxPrimitive.InputGroup
      data-slot="combobox-input-group"
      render={<SearchBar />}
      className={cn("shrink-0", className)}
    >
      <SearchBarIcon>
        <SearchIcon size={20} />
      </SearchBarIcon>
      <ComboboxPrimitive.Input
        data-slot="combobox-input"
        render={<SearchBarInput placeholder={placeholder} />}
        {...props}
      />
      {children}
    </ComboboxPrimitive.InputGroup>
  );
}

function ComboboxList({ className, ...props }: Readonly<StringClassName<ComboboxPrimitive.List.Props>>) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        "max-h-52 min-h-0 overflow-y-auto overscroll-contain rounded-md border border-border bg-fill-subtle data-empty:hidden",
        className,
      )}
      {...props}
    />
  );
}

type ComboboxItemProps = StringClassName<ComboboxPrimitive.Item.Props> & {
  icon?: ReactNode;
  description?: ReactNode;
};

function ComboboxItem({ className, icon, description, children, ...props }: Readonly<ComboboxItemProps>) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "group/combobox-item flex min-h-14 w-full cursor-pointer items-center gap-2 border-b-[0.5px] border-border-subtle pl-3.5 outline-hidden select-none last:border-b-0 data-highlighted:bg-fill",
        className,
      )}
      {...props}
    >
      {icon && (
        <span aria-hidden className="flex shrink-0 text-icon-subtle">
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col pr-4 pl-0.5">
        <span className="text-body-s-emphasis wrap-break-word text-text">{children}</span>
        {description && (
          <span className="text-caption-m-regular text-text-subtle group-data-highlighted/combobox-item:text-[var(--gray-800)]">
            {description}
          </span>
        )}
      </span>
      <ComboboxPrimitive.ItemIndicator className="grid size-12 shrink-0 place-items-center text-primary">
        <CheckIcon size={16} />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

function ComboboxEmpty({ className, children, ...props }: Readonly<StringClassName<ComboboxPrimitive.Empty.Props>>) {
  return (
    <ComboboxPrimitive.Empty data-slot="combobox-empty" className={cn("empty:absolute", className)} {...props}>
      <div className="flex min-h-14.5 items-center rounded-md border border-border bg-fill-subtle pl-4.5 pr-4 text-body-s-regular text-text-subtle">
        {children}
      </div>
    </ComboboxPrimitive.Empty>
  );
}

export {
  Combobox,
  ComboboxLabel,
  ComboboxTrigger,
  ComboboxValue,
  ComboboxContent,
  ComboboxInput,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
};
