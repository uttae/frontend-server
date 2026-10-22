import Image from "next/image";

/** Original vector exports from Figma 6153:8257; explicit dimensions preserve the glyphs. */
export function MapSearchIcon({ name, size = 16, className }: Readonly<{
  name: "restaurant" | "hotel" | "attraction" | "museum" | "transit" |
    "chevron-down" | "reset" | "search" | "search-white" | "location" |
    "clear" | "close" | "star" | "arrow-right";
  size?: number;
  className?: string;
}>) {
  return <Image src={`/map-search/${name}.svg`} alt="" width={size} height={size}
    unoptimized draggable={false} className={className ?? "shrink-0"} />;
}
