"use client";

import { useEffect } from "react";

type AutoPrintProps = {
  enabled?: boolean;
  /** Wait for every image on the page to load and decode (and for web fonts) before opening
   *  the print dialog. Safari snapshots the page the moment print() is called, so an image
   *  still downloading prints as an empty box. Capped by maxWaitMs so one slow or broken image
   *  can never block printing. */
  waitForAssets?: boolean;
  maxWaitMs?: number;
};

async function waitForPrintAssets(maxWaitMs: number): Promise<void> {
  const images = Array.from(document.images);
  // decode() resolves once the image is fully loaded AND decoded; it rejects for a broken
  // image, which simply falls back to the placeholder box — never a reason to block.
  const imagesReady = Promise.all(images.map((image) => image.decode().catch(() => undefined)));
  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  await Promise.race([
    Promise.all([imagesReady, fontsReady]),
    new Promise((resolve) => setTimeout(resolve, maxWaitMs)),
  ]);
}

/** Opens the browser print dialog automatically once the report has rendered — both "Print
 *  current list" and "Download PDF" (browser Save as PDF) land on this same report page, so
 *  triggering it once here covers both without duplicating the print page per action. The
 *  toolbar's manual Print button stays as a fallback if the dialog is dismissed or blocked. */
export function AutoPrint({ enabled = true, waitForAssets = false, maxWaitMs = 5000 }: AutoPrintProps) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    if (!waitForAssets) {
      const timer = setTimeout(() => window.print(), 150);
      return () => clearTimeout(timer);
    }

    waitForPrintAssets(maxWaitMs).then(() => {
      if (!cancelled) window.print();
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, waitForAssets, maxWaitMs]);

  return null;
}
