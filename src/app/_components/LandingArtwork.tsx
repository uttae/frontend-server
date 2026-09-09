import Image from "next/image";
import type { CSSProperties } from "react";

import styles from "./landing.module.css";

/** Exact exports from approved Figma nodes 636:943 and 614:1123. */
export function LandingArtwork({
  name, mobileName, width, height, className, style, alt = "", priority = false,
}: {
  name: string;
  mobileName?: string;
  width: number;
  height: number;
  className?: string;
  style?: CSSProperties;
  alt?: string;
  priority?: boolean;
}) {
  const image = <Image src={`/landing/figma/${name}`} width={Math.round(width)} height={Math.round(height)}
    alt={alt} className={className} style={style} priority={priority}
    sizes={`(max-width: 719px) 100vw, ${width}px`} />;
  return mobileName ? <picture>
    <source media="(max-width: 719px)" srcSet={`/landing/figma/${mobileName}`} />
    {image}
  </picture> : image;
}

export function LandingLogo() {
  return <span className={styles.logo} aria-hidden="true">
    <LandingArtwork name="wordmark.svg" mobileName="mobile-wordmark.svg" width={61.6858} height={30.0094} className={styles.wordmark} />
    <LandingArtwork name="symbol.svg" mobileName="mobile-symbol.svg" width={29.8368} height={29.9922} className={styles.symbol} />
  </span>;
}
