import type { ComponentType, SVGProps } from "react";

import { cn } from "@/lib/utils";

export type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

const ICON_BASE_CLASS = "shrink-0 [&_*]:[vector-effect:non-scaling-stroke]";

export function createIcon(Svg: ComponentType<SVGProps<SVGSVGElement>>, displayName: string) {
  function Icon({ size = 24, className, ...props }: IconProps) {
    return (
      <Svg
        width={size}
        height={size}
        aria-hidden
        focusable="false"
        className={cn(ICON_BASE_CLASS, className)}
        {...props}
      />
    );
  }
  Icon.displayName = displayName;
  return Icon;
}
