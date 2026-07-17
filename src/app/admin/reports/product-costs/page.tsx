import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProductCostReport } from "@/lib/services/report.service";
import { listCategories } from "@/lib/services/product.service";
import { getCurrentAuthState } from "@/lib/auth/session";
import { canViewCostData } from "@/lib/auth/permissions";
import { formatBhd } from "@/lib/formatters/currency";
import { formatInr } from "@/lib/utils/cost-conversion";

const LOW_MARGIN_THRESHOLD = 20;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProductCostReportPage({ searchParams }: PageProps) {
  const [params, auth] = await Promise.all([searchParams, getCurrentAuthState()]);
  const role = auth.profile?.role ?? null;

  if (!canViewCostData(role)) {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Reports</p>
          <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Product cost report</h1>
        </header>
        <Card className="shadow-soft">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            You do not have permission to view this report.
          </CardContent>
        </Card>
      </div>
    );
  }

  const missingCostOnly = getParam(params, "missingCost") === "1";
  const lowMarginOnly = getParam(params, "lowMargin") === "1";
  const categoryId = getParam(params, "categoryId") ?? "all";

  const [allRows, categories] = await Promise.all([getProductCostReport(), listCategories()]);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const selectedCategoryName = categoryId !== "all" ? categoryNameById.get(categoryId) ?? null : null;

  const rows = allRows.filter((row) => {
    if (missingCostOnly && row.missingCostCount === 0) return false;
    if (lowMarginOnly && (row.estimatedMarginPercent === null || row.estimatedMarginPercent >= LOW_MARGIN_THRESHOLD)) {
      return false;
    }
    if (selectedCategoryName && row.categoryName !== selectedCategoryName) return false;
    return true;
  });

  function hrefWith(overrides: Record<string, string>) {
    const next = new URLSearchParams();
    if (missingCostOnly) next.set("missingCost", "1");
    if (lowMarginOnly) next.set("lowMargin", "1");
    if (categoryId !== "all") next.set("categoryId", categoryId);
    for (const [key, value] of Object.entries(overrides)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const qs = next.toString();
    return qs ? `/admin/reports/product-costs?${qs}` : "/admin/reports/product-costs";
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold">Reports</p>
        <h1 className="mt-2 text-3xl font-semibold text-musiva-plum">Product cost report</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Buying cost, selling value, and margin per product. Only variants with a valid buying
          cost (INR price and exchange rate both recorded) contribute to the totals below.
        </p>
      </header>

      <Card className="shadow-soft">
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <Button asChild size="sm" variant={missingCostOnly ? "default" : "outline"}>
            <Link href={hrefWith({ missingCost: missingCostOnly ? "" : "1" })}>Missing cost</Link>
          </Button>
          <Button asChild size="sm" variant={lowMarginOnly ? "default" : "outline"}>
            <Link href={hrefWith({ lowMargin: lowMarginOnly ? "" : "1" })}>
              Low margin (under {LOW_MARGIN_THRESHOLD}%)
            </Link>
          </Button>
          <form action="/admin/reports/product-costs" className="ml-auto flex gap-2">
            {missingCostOnly && <input type="hidden" name="missingCost" value="1" />}
            {lowMarginOnly && <input type="hidden" name="lowMargin" value="1" />}
            <Select defaultValue={categoryId} name="categoryId">
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Button size="sm" type="submit" variant="outline">
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Total stock</TableHead>
              <TableHead className="text-right">Valid cost</TableHead>
              <TableHead className="text-right">Missing cost</TableHead>
              <TableHead className="text-right">Buying value (INR)</TableHead>
              <TableHead className="text-right">Buying value (BHD)</TableHead>
              <TableHead className="text-right">Selling value (BHD)</TableHead>
              <TableHead className="text-right">Gross profit</TableHead>
              <TableHead className="text-right">Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell className="h-28 text-center text-muted-foreground" colSpan={10}>
                  No products match these filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.productId}>
                  <TableCell>
                    <Link className="font-medium text-musiva-plum hover:underline" href={`/admin/products/${row.productId}`}>
                      {row.productName}
                    </Link>
                  </TableCell>
                  <TableCell>{row.categoryName ?? "Uncategorized"}</TableCell>
                  <TableCell className="text-right">{row.totalStock}</TableCell>
                  <TableCell className="text-right">{row.validCostCount}</TableCell>
                  <TableCell className="text-right">
                    {row.missingCostCount > 0 ? (
                      <Badge className="text-[10px]" variant="warning">
                        {row.missingCostCount}
                      </Badge>
                    ) : (
                      0
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.validCostCount > 0 ? formatInr(row.totalBuyingValueInr) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.validCostCount > 0 ? formatBhd(row.totalBuyingValueBhd) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.validCostCount > 0 ? formatBhd(row.estimatedSellingValueBhd) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.validCostCount > 0 ? formatBhd(row.estimatedGrossProfitBhd) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.estimatedMarginPercent !== null ? (
                      <Badge
                        className="text-[10px]"
                        variant={row.estimatedMarginPercent < LOW_MARGIN_THRESHOLD ? "danger" : "success"}
                      >
                        {row.estimatedMarginPercent.toFixed(1)}%
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
