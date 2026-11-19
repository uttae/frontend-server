import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const skeletonVariants = cva("block animate-pulse rounded-[0.25rem] motion-reduce:animate-none", {
  variants: {
    tone: {
      strong: "bg-fill-strong",
      subtle: "bg-fill",
    },
  },
  defaultVariants: { tone: "strong" },
});

function Skeleton({
  className,
  tone,
  render,
  ...props
}: Readonly<useRender.ComponentProps<"div"> & VariantProps<typeof skeletonVariants>>) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">({ "aria-hidden": true, className: cn(skeletonVariants({ tone }), className) }, props),
    state: { slot: "skeleton" },
  });
}

export { Skeleton };
