import { ExpenseForm } from "@/components/expenses/expense-form";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BackLink } from "@/components/layout/back-link";

export default function NewExpensePage() {
  return (
    <div className="space-y-6">
      <header>
        <Breadcrumb
          segments={[
            { label: "Management" },
            { label: "Expenses", href: "/admin/expenses" },
            { label: "New Expense" },
          ]}
        />
        <div className="mt-2">
          <BackLink href="/admin/expenses" label="Back to expenses" />
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">New expense</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Record boutique costs using BHD amounts with three decimal places.
        </p>
      </header>
      <ExpenseForm />
    </div>
  );
}
