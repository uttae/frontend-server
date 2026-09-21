import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type MainPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** (main) 내부 페이지 좌측 상단 제목·설명·우측 액션 공통 컨테이너 */
export function MainPageHeader({
  title,
  description,
  action,
  className,
}: MainPageHeaderProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-title-l font-bold text-black">{title}</h1>
        {description ? (
          <p className="mt-1 text-body-s-regular leading-relaxed text-dark-gray">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
