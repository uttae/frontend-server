import type { ReactNode } from "react";

import { SetSectionMaxWidth } from "@/contexts/SectionWidthContext";

/** member-settings 등 s1 본문 폭 설정 탭 공통 레이아웃 */
export function MainSettingsPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 rounded-2xl pb-10">
      <SetSectionMaxWidth value="s1" />
      {children}
    </div>
  );
}
