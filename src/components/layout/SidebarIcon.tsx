import { cn } from "@/lib/utils";

/** Exact Figma SVG silhouette; semantic colors support both selected states. */
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
