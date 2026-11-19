import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type MainPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function MainPageHeader({ title, description, action, className }: MainPageHeaderProps) {
  return (
    <div className={cn("flex min-h-19 min-w-0 items-center justify-between gap-3 py-3", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h1 className="truncate text-title-l text-text">{title}</h1>
        {description ? <p className="text-body-s-regular text-text-subtle">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
