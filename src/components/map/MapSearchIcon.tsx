import Image from "next/image";

export function MapSearchIcon({
  name,
  size = 16,
  className,
}: Readonly<{
  name: "chevron-down" | "search" | "search-white" | "location" | "close" | "star" | "arrow-right";
  size?: number;
  className?: string;
}>) {
  return (
    <Image
      src={`/map-search/${name}.svg`}
      alt=""
      width={size}
      height={size}
      unoptimized
      draggable={false}
      className={className ?? "shrink-0"}
    />
  );
}
