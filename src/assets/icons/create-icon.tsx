import type { ComponentType, SVGProps } from "react";

import { cn } from "@/lib/utils";

export type IconProps = SVGProps<SVGSVGElement> & {
  /** px — Figma 권장 사이즈(12 / 16 / 20 / 24 / 28 / 32) */
  size?: number;
};

/**
 * Figma 아이콘은 크기와 상관없이 stroke가 1.8px이다.
 * viewBox 24 기준 SVG를 16·20으로 줄여도 선 굵기가 같도록 non-scaling-stroke를 건다.
 */
const ICON_BASE_CLASS = "shrink-0 [&_*]:[vector-effect:non-scaling-stroke]";

/** SVGR 컴포넌트를 크기·색(currentColor)을 props/className으로 받는 아이콘 컴포넌트로 감싼다 */
export function createIcon(
  Svg: ComponentType<SVGProps<SVGSVGElement>>,
  displayName: string,
) {
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
