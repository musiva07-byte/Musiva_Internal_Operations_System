"use client";

import { useEffect } from "react";

/** Opens the browser print dialog automatically once the report has rendered — both "Print
 *  current list" and "Download PDF" (browser Save as PDF) land on this same report page, so
 *  triggering it once here covers both without duplicating the print page per action. The
 *  toolbar's manual Print button stays as a fallback if the dialog is dismissed or blocked. */
export function AutoPrint({ enabled = true }: { enabled?: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => window.print(), 150);
    return () => clearTimeout(timer);
  }, [enabled]);

  return null;
}
