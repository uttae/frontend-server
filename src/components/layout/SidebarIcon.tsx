import { cn } from "@/lib/utils";

/** Apply the same semantic colors while preserving each SVG silhouette. */
export function SidebarIcon({ src, isActive = false }: { src: string; isActive?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block size-6 shrink-0", isActive ? "bg-primary-subtle" : "bg-icon")}
      style={{
        maskImage: `url("${src}")`,
        maskSize: "100% 100%",
        maskPosition: "center",
        maskRepeat: "no-repeat",
      }}
    />
  );
}
