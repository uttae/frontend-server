import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** A compact visual indicator with a screen-reader-only loading announcement. */
export function LoadingIndicator({
  label = "불러오는 중",
  className,
  size = 20,
}: Readonly<{
  label?: string;
  className?: string;
  size?: number;
}>) {
  return (
    <output aria-label={label} className={cn("inline-flex items-center justify-center text-text-subtle", className)}>
      <LoaderCircle size={size} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
    </output>
  );
}
