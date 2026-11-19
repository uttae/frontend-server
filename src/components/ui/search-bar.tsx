import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { ChevronLeftIcon, CloseIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";

const searchBarVariants = cva(
  "flex h-12 w-full min-w-0 items-center gap-2 border border-border bg-fill-subtle pl-3.5 pr-2.5 transition-colors focus-within:border-primary has-[input:disabled]:bg-fill [&:has(input:not(:placeholder-shown)):not(:focus-within)]:border-primary-strong",
  {
    variants: {
      shape: {
        rounded: "rounded-md",
        pill: "rounded-full",
      },
    },
    defaultVariants: { shape: "rounded" },
  },
);

function SearchBar({
  className,
  shape,
  ...props
}: Readonly<ComponentProps<"div"> & VariantProps<typeof searchBarVariants>>) {
  return (
    <div
      data-slot="search-bar"
      className={cn(searchBarVariants({ shape }), className)}
      {...props}
    />
  );
}

function SearchBarIcon({ className, ...props }: Readonly<ComponentProps<"span">>) {
  return (
    <span
      aria-hidden
      data-slot="search-bar-icon"
      className={cn("flex shrink-0 text-icon-subtle", className)}
      {...props}
    />
  );
}

function SearchBarBack({ className, ...props }: Readonly<ComponentProps<"button">>) {
  return (
    <button
      type="button"
      data-slot="search-bar-back"
      className={cn(
        "-mx-1.5 grid w-8 shrink-0 cursor-pointer place-items-center self-stretch text-icon-subtle focus-visible:outline-2 focus-visible:outline-primary",
        className,
      )}
      {...props}
    >
      <ChevronLeftIcon size={20} />
    </button>
  );
}

function SearchBarInput({
  className,
  placeholder,
  ...props
}: Readonly<ComponentProps<"input"> & { placeholder: string }>) {
  return (
    <input
      data-slot="search-bar-input"
      placeholder={placeholder}
      className={cn(
        "min-w-0 flex-1 self-stretch bg-transparent pr-1 text-body-m-regular text-text outline-none placeholder:text-text-subtle disabled:cursor-not-allowed disabled:text-text-disabled [&::-webkit-search-cancel-button]:hidden",
        className,
      )}
      {...props}
    />
  );
}

function SearchBarClear({ className, ...props }: Readonly<ComponentProps<"button">>) {
  return (
    <button
      type="button"
      data-slot="search-bar-clear"
      className={cn(
        "grid w-8 shrink-0 cursor-pointer place-items-center self-stretch text-icon-subtle focus-visible:outline-2 focus-visible:outline-primary",
        className,
      )}
      {...props}
    >
      <CloseIcon size={20} />
    </button>
  );
}

export { SearchBar, SearchBarBack, SearchBarIcon, SearchBarInput, SearchBarClear };
