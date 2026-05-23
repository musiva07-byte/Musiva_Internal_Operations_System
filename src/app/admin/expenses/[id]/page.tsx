import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getExpense } from "@/lib/services/expense.service";
import { formatBhd } from "@/lib/formatters/currency";
import { formatDate, formatDateTime } from "@/lib/formatters/date";
import { titleize } from "@/lib/formatters/labels";

type ExpensePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ExpensePage({ params }: ExpensePageProps) {
  const { id } = await params;
  const expense = await getExpense(id);

  if (!expense) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Expenses</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">{formatBhd(expense.amount)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {titleize(expense.category)} on {formatDate(expense.expense_date)}
          </p>
        </div>
        {expense.attachment_url ? (
          <Button asChild variant="outline">
            <Link href={expense.attachment_url} target="_blank">
              <ExternalLink aria-hidden className="mr-2 h-4 w-4" />
              Attachment
            </Link>
          </Button>
        ) : null}
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Category</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{titleize(expense.category)}</Badge>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Payment method</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-musiva-plum">{titleize(expense.payment_method)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Created</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-musiva-plum">{formatDateTime(expense.created_at)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Vendor</p>
            <p className="mt-1 font-medium text-musiva-plum">{expense.vendor ?? "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Expense date</p>
            <p className="mt-1 font-medium text-musiva-plum">{formatDate(expense.expense_date)}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-muted-foreground">Notes</p>
            <p className="mt-1 leading-6">{expense.notes ?? "No notes saved."}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
