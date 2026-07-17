"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { setExchangeRateAction } from "@/app/admin/settings/actions";
import { formatDateTime } from "@/lib/formatters/date";
import type { ExchangeRateRow } from "@/types/database";

type Props = {
  currentRate: ExchangeRateRow | null;
  updatedByName: string | null;
};

export function ExchangeRateSettings({ currentRate, updatedByName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rate, setRate] = useState(currentRate ? String(currentRate.rate) : "");
  const [effectiveDate, setEffectiveDate] = useState(
    currentRate?.rate_date ?? new Date().toISOString().slice(0, 10),
  );
  const [source, setSource] = useState<"manual" | "bank" | "other">(
    (currentRate?.source as "manual" | "bank" | "other") ?? "manual",
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await setExchangeRateAction({
        quoteCurrency: "INR",
        rate: Number(rate) || 0,
        effectiveDate,
        source,
      });

      if (!result.ok) {
        setError(result.error ?? "Exchange rate could not be saved.");
        return;
      }

      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle>Exchange Rates</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          The current INR → BHD rate. New products auto-fill this rate — staff never type it.
          Changing it here never changes buying costs already saved on existing products.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-md bg-musiva-ivory p-4 text-sm">
          {currentRate ? (
            <div className="space-y-1">
              <p className="text-lg font-semibold text-musiva-plum">
                1 INR = BHD {Number(currentRate.rate).toFixed(6)}
              </p>
              <p className="text-muted-foreground">Effective date: {currentRate.rate_date}</p>
              <p className="text-muted-foreground">
                Source: {currentRate.source === "manual" ? "Manual" : currentRate.source === "bank" ? "Bank" : "Other"}
              </p>
              <p className="text-muted-foreground">
                Last updated: {formatDateTime(currentRate.updated_at)}
                {updatedByName ? ` by ${updatedByName}` : ""}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">
              No INR to BHD exchange rate is set yet. Add today&apos;s rate below.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="new-rate">New rate (1 INR = ? BHD)</Label>
            <Input
              id="new-rate"
              min={0}
              placeholder="0.004520"
              step="0.000001"
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rate-effective-date">Effective date</Label>
            <Input
              id="rate-effective-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rate-source">Source</Label>
            <Select
              id="rate-source"
              value={source}
              onChange={(e) => setSource(e.target.value as "manual" | "bank" | "other")}
            >
              <option value="manual">Manual</option>
              <option value="bank">Bank</option>
              <option value="other">Other</option>
            </Select>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm font-medium text-musiva-sage">Exchange rate updated.</p>}

        <Button disabled={isPending} type="button" onClick={handleSubmit}>
          {isPending ? <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save exchange rate
        </Button>
      </CardContent>
    </Card>
  );
}
