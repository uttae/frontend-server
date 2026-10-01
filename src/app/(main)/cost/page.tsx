import { ExpensePanel } from "@/components/expenses/ExpensePanel";

export default function CostPage() {
  return (
    <div className="min-w-0 space-y-2.5 pb-8 mobile:bg-fill max-sm:bg-fill">
      <ExpensePanel />
    </div>
  );
}
