import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export function MapCloseButton({
  label,
  onClick,
  className,
}: Readonly<{ label: string; onClick: () => void; className?: string }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-dark-gray shadow-md transition hover:bg-gray-50",
        className,
      )}
    >
      <X className="h-4 w-4" aria-hidden />
    </button>
  );
}
