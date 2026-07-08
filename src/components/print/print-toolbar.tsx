"use client";

import Link from "next/link";
import { ArrowLeft, FileText, Printer, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";

type PrintToolbarProps = {
  orderId: string;
  /** Show "Receipt only" link. False for standalone invoice page. */
  showReceiptOnly?: boolean;
  /** Show "Label only" link. False for walk-in/pickup orders and standalone label page. */
  showLabelOnly?: boolean;
};

export function PrintToolbar({
  orderId,
  showReceiptOnly = true,
  showLabelOnly = true,
}: PrintToolbarProps) {
  return (
    <div className="no-print mx-auto mb-4 flex w-[210mm] flex-wrap items-center gap-2 px-1">
      <Button asChild size="sm" variant="outline">
        <Link href={`/admin/orders/${orderId}`}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to order
        </Link>
      </Button>
      <div className="ml-auto flex items-center gap-2">
        {showReceiptOnly && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/print/invoice/${orderId}`} rel="noopener" target="_blank">
              <FileText className="mr-1.5 h-4 w-4" />
              Receipt only
            </Link>
          </Button>
        )}
        {showLabelOnly && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/print/label/${orderId}`} rel="noopener" target="_blank">
              <Tags className="mr-1.5 h-4 w-4" />
              Label only
            </Link>
          </Button>
        )}
        <Button size="sm" type="button" onClick={() => window.print()}>
          <Printer className="mr-1.5 h-4 w-4" />
          Print
        </Button>
      </div>
    </div>
  );
}
