"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva } from "class-variance-authority";
import { createContext, useContext, useMemo } from "react";

import { cn } from "@/lib/utils";

type ClassNameProp = { className?: string };

function Tabs({ className, ...props }: Readonly<Omit<TabsPrimitive.Root.Props, "className"> & ClassNameProp>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col data-[orientation=vertical]:flex-row", className)}
      {...props}
    />
  );
}

type TabsStyle = {
  variant: "line" | "solid" | "outline";
  size: "lg" | "md" | "sm";
  layout: "fill" | "hug";
};

const TabsStyleContext = createContext<TabsStyle>({ variant: "line", size: "md", layout: "fill" });

const tabsListVariants = cva("flex data-[orientation=vertical]:flex-col", {
  variants: {
    variant: {
      line: "",
      solid: "gap-2",
      outline: "gap-2",
    },
  },
});

type TabsListProps = Omit<TabsPrimitive.List.Props, "className"> &
  ClassNameProp &
  (
    | {
        variant?: "line";
        size?: "md" | "sm";
        layout?: "fill" | "hug";
      }
    | {
        variant: "solid" | "outline";
        size?: "lg" | "md";
        layout?: never;
      }
  );

function TabsList({ className, variant = "line", size, layout, ...props }: Readonly<TabsListProps>) {
  const resolvedSize = size ?? (variant === "line" ? "md" : "lg");
  const resolvedLayout = variant === "line" ? (layout ?? "fill") : "hug";
  const style = useMemo(
    () => ({ variant, size: resolvedSize, layout: resolvedLayout }),
    [variant, resolvedSize, resolvedLayout],
  );
  return (
    <TabsStyleContext.Provider value={style}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      />
    </TabsStyleContext.Provider>
  );
}

const tabsTriggerVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 px-6 whitespace-nowrap text-text-subtle transition-[color,background-color,border-color,box-shadow] duration-120 ease-out focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none data-disabled:cursor-not-allowed data-disabled:text-text-disabled",
  {
    variants: {
      variant: {
        line: "shadow-[inset_0_-2px_0_var(--color-border-subtle)] focus-visible:-outline-offset-2 aria-selected:text-primary-strong aria-selected:shadow-[inset_0_-2px_0_var(--color-primary-default)] data-disabled:shadow-[inset_0_-2px_0_var(--color-border-subtle)]",
        solid:
          "rounded-full bg-fill-subtle focus-visible:outline-offset-2 aria-selected:bg-primary aria-selected:text-text-inverse data-disabled:bg-fill-subtle",
        outline:
          "rounded-full border border-border bg-fill-subtle focus-visible:outline-offset-2 aria-selected:border-primary aria-selected:bg-[var(--blue-50)] aria-selected:text-primary-strong data-disabled:border-border data-disabled:bg-fill-subtle",
      },
      size: { lg: "", md: "", sm: "" },
      layout: { fill: "flex-1", hug: "" },
    },
    compoundVariants: [
      {
        variant: "line",
        size: "md",
        className: "min-h-11 text-label-l-regular aria-selected:text-label-l-emphasis data-disabled:text-label-l-regular",
      },
      {
        variant: "line",
        size: "sm",
        className: "min-h-10 text-label-m-regular aria-selected:text-label-m-emphasis data-disabled:text-label-m-regular",
      },
      {
        variant: ["solid", "outline"],
        size: "lg",
        className: "min-h-11 text-label-l-regular aria-selected:text-label-l-emphasis data-disabled:text-label-l-regular",
      },
      {
        variant: ["solid", "outline"],
        size: "md",
        className: "min-h-9 text-label-m-regular aria-selected:text-label-m-emphasis data-disabled:text-label-m-regular",
      },
    ],
  },
);

function TabsTrigger({ className, ...props }: Readonly<Omit<TabsPrimitive.Tab.Props, "className"> & ClassNameProp>) {
  const style = useContext(TabsStyleContext);
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants(style), className)}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: Readonly<Omit<TabsPrimitive.Panel.Props, "className"> & ClassNameProp>) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn(
        "min-w-0 flex-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
