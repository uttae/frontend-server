import { ExpensePanel } from "@/components/expenses/ExpensePanel";
import { SetSectionMaxWidth } from "@/contexts/SectionWidthContext";

export default function CostPage() {
  return (
    <div className="min-w-0 space-y-2.5 pb-8">
      <SetSectionMaxWidth value="s1" />
      <ExpensePanel />
    </div>
  );
}
