import type { ReactNode } from "react";

import { SetSectionMaxWidth } from "@/contexts/SectionWidthContext";

export function MainSettingsPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 rounded-2xl pb-10">
      <SetSectionMaxWidth value="s1" />
      {children}
    </div>
  );
}
