import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const switchVariants = cva(
  "group/switch inline-flex shrink-0 cursor-pointer items-center focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed",
  {
    variants: {
      size: {
        md: "min-h-11 rounded-lg p-1 focus-visible:outline-offset-4",
        sm: "rounded-full focus-visible:outline-offset-2",
      },
    },
    defaultVariants: { size: "md" },
  },
);

const switchTrackVariants = cva(
  "flex items-center rounded-full transition-colors group-aria-checked/switch:bg-primary motion-reduce:transition-none",
  {
    variants: {
      size: {
        md: "h-7 w-12 bg-[var(--gray-600)] p-1",
        sm: "h-5 w-10 bg-icon-disabled p-0.5",
      },
    },
    defaultVariants: { size: "md" },
  },
);

const switchThumbVariants = cva("rounded-full transition-transform motion-reduce:transition-none", {
  variants: {
    size: {
      md: "size-5 bg-fill-elevate shadow-[0_1px_3px_0_rgb(0_0_0/0.1),0_1px_2px_-1px_rgb(0_0_0/0.1)] data-checked:translate-x-5",
      sm: "size-4 bg-icon-inverse data-checked:translate-x-5",
    },
  },
  defaultVariants: { size: "md" },
});

type SwitchProps = Omit<SwitchPrimitive.Root.Props, "className" | "nativeButton" | "render"> &
  VariantProps<typeof switchVariants> & {
    className?: string;
  };

function Switch({ className, size, ...props }: Readonly<SwitchProps>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      nativeButton
      render={<button type="button" />}
      className={cn(switchVariants({ size }), className)}
      {...props}
    >
      <span data-slot="switch-track" className={switchTrackVariants({ size })}>
        <SwitchPrimitive.Thumb data-slot="switch-thumb" className={switchThumbVariants({ size })} />
      </span>
    </SwitchPrimitive.Root>
  );
}

export { Switch };
