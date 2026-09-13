import { ExpensePanel } from "@/components/expenses/ExpensePanel";
import { MainPageHeader } from "@/components/layout/MainPageHeader";
import { SetSectionMaxWidth } from "@/contexts/SectionWidthContext";

export default function CostPage() {
  return (
    <div className="min-w-0 space-y-2.5 pb-8">
      <SetSectionMaxWidth value="s1" />
      <MainPageHeader title="비용" />
      <ExpensePanel />
    </div>
  );
}
