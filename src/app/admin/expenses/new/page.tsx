import { ExpenseForm } from "@/components/expenses/expense-form";

export default function NewExpensePage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Expenses</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">New expense</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Record boutique costs using BHD amounts with three decimal places.
        </p>
      </header>
      <ExpenseForm />
    </div>
  );
}
