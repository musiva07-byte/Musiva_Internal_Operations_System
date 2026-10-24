"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReportPrintToolbarProps = {
  /** Where "Back" returns to — the originating list page (with its filters preserved). */
  backHref: string;
  /** Optional report-specific print-setup guidance (e.g. recommended paper size), shown under
   *  the buttons. Screen-only, like the rest of the toolbar. */
  hint?: ReactNode;
};

/** Matches PrintToolbar's layout (invoice/label) for visual consistency, simplified to the
 *  two actions a report needs. "Download PDF" from the Export menu opens this same page and
 *  triggers the browser's print dialog — staff choose "Save as PDF" there (see the Export
 *  menu's note); there is no separate PDF generation path. Print calls the browser's native
 *  print dialog — paper size, orientation and scale are chosen there by staff; JavaScript
 *  cannot set them. */
export function ReportPrintToolbar({ backHref, hint }: ReportPrintToolbarProps) {
  return (
    <div className="no-print mx-auto mb-4 w-[210mm] px-1">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={backHref}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to list
          </Link>
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <p className="text-xs text-muted-foreground">Use your browser&apos;s print dialog to Save as PDF.</p>
          <Button size="sm" type="button" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>
      {hint ? <div className="mt-2 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
