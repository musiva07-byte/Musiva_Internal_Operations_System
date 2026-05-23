import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/products/pagination";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { listExpenses } from "@/lib/services/expense.service";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDate } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";

type ExpensesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = await searchParams;
  const q = getParam(params, "q") ?? "";
  const category = getParam(params, "category") ?? "all";
  const page = Number(getParam(params, "page") ?? 1);
  const expenses = await listExpenses({ q, category, page });

  const hrefForPage = (nextPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (category !== "all") next.set("category", category);
    next.set("page", String(nextPage));
    return `/admin/expenses?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Expenses</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Expense records</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track boutique operating costs for finance reports and net profit estimates.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/expenses/new">
            <Plus aria-hidden className="mr-2 h-4 w-4" />
            New expense
          </Link>
        </Button>
      </header>

      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-[1fr_240px_auto]">
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" defaultValue={q} name="q" placeholder="Search vendor or notes" />
            </div>
            <Select defaultValue={category} name="category">
              <option value="all">All categories</option>
              {Object.values(EXPENSE_CATEGORIES).map((expenseCategory) => (
                <option key={expenseCategory} value={expenseCategory}>
                  {titleize(expenseCategory)}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="outline">
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expense</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.data.length === 0 ? (
              <TableRow>
                <TableCell className="h-28 text-center text-muted-foreground" colSpan={5}>
                  No expenses found.
                </TableCell>
              </TableRow>
            ) : (
              expenses.data.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>
                    <Link className="font-medium text-musiva-plum hover:underline" href={`/admin/expenses/${expense.id}`}>
                      {formatDate(expense.expense_date)}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{expense.notes ?? "No notes"}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{titleize(expense.category)}</Badge>
                  </TableCell>
                  <TableCell>{titleize(expense.payment_method)}</TableCell>
                  <TableCell>{expense.vendor ?? "-"}</TableCell>
                  <TableCell className="text-right">{formatBhd(expense.amount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Pagination href={hrefForPage} page={expenses.page} pageCount={expenses.pageCount} />
    </div>
  );
}
