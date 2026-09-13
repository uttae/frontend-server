import Image from "next/image";
import { sidebarIcons } from "@/lib/public-assets";
import { cn } from "@/lib/utils";

/** Preserve the calculator artwork; other icons use semantic silhouette colors. */
export function SidebarIcon({ src, isActive = false }: { src: string; isActive?: boolean }) {
  if (src === sidebarIcons.cost) {
    return <Image src={src} alt="" width={24} height={24} className="block size-6 shrink-0" />;
  }

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
