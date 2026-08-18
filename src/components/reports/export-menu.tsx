"use client";

import { useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ExportMenuProps = {
  /** /print/products or /print/inventory, with the current page's filters as query params. */
  printHref: string;
  /** /api/admin/products/export or /api/admin/inventory/export, same filters. */
  csvHref: string;
};

const EXPORT_ERROR = "Could not export the report. Please try again or contact the administrator.";

/** "Export ▾" — Print current list / Download PDF / Download CSV, shared by Product Catalog
 *  and Stock Management. Print and PDF both open the same print-friendly report page (there
 *  is no PDF generation library in this project — see AGENTS.md — so "PDF" means the
 *  browser's own Save as PDF print destination). CSV is fetched and downloaded as a blob
 *  rather than a plain link so a failed export can show the required friendly message
 *  instead of navigating to a raw error response. */
export function ExportMenu({ printHref, csvHref }: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadCsv() {
    setError(null);
    setIsExporting(true);
    try {
      const response = await fetch(csvHref);
      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? "export.csv";

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[ExportMenu] CSV download failed:", err);
      setError(EXPORT_ERROR);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button disabled={isExporting} variant="outline">
            <Download aria-hidden className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export"}
            <ChevronDown aria-hidden className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem asChild>
            <a href={printHref} rel="noopener" target="_blank">
              <Printer aria-hidden className="mr-2 h-4 w-4" />
              Print current list
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="flex-col items-start gap-0.5">
            <a href={printHref} rel="noopener" target="_blank">
              <span className="flex items-center">
                <FileText aria-hidden className="mr-2 h-4 w-4" />
                Download PDF
              </span>
              <span className="pl-6 text-[11px] leading-tight text-muted-foreground">
                Use your browser&apos;s print dialog, then Save as PDF
              </span>
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={downloadCsv}>
            <FileSpreadsheet aria-hidden className="mr-2 h-4 w-4" />
            Download CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? (
        <p className="absolute right-0 top-full z-10 mt-1 w-64 rounded-md border border-destructive/20 bg-destructive/5 p-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
