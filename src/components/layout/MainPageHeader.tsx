import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type MainPageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/**
 * (main) 탭 화면 제목 줄 — Figma Header(가계부 6576:26503 등).
 * PC 높이 76 = 위아래 여백 12 + 제목 30 + 간격 2 + 설명 20.
 * 모바일은 기존 모양(여백·설명 줄 없음)을 유지한다. 모바일 시안(64px)은 아직 옮기지 않았다.
 */
export function MainPageHeader({
  title,
  description,
  action,
  className,
}: MainPageHeaderProps) {
  return (
    <div
      className={cn(
        "flex min-h-19 min-w-0 items-center justify-between gap-3 py-3 mobile:min-h-0 mobile:py-0",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h1 className="truncate text-title-l text-text mobile:text-title-m">{title}</h1>
        {description ? (
          <p className="text-body-s-regular text-text-subtle mobile:hidden">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
