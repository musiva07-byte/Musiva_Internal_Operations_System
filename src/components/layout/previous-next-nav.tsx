import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type AdjacentItem = { id: string; label: string } | null;

/**
 * Previous/next navigation for detail pages, e.g. "Previous order / Next order". Extracted
 * from the order detail page's original inline implementation so product/customer detail pages
 * can reuse the exact same look and disabled-state handling.
 */
export function PreviousNextNav({
  previous,
  next,
  hrefFor,
  previousLabel = "Previous",
  nextLabel = "Next",
}: {
  previous: AdjacentItem;
  next: AdjacentItem;
  hrefFor: (id: string) => string;
  previousLabel?: string;
  nextLabel?: string;
}) {
  return (
    <div className="mt-2 flex items-center gap-3 text-sm">
      {previous ? (
        <Link
          href={hrefFor(previous.id)}
          className="flex items-center gap-1 font-medium text-musiva-plum hover:underline"
        >
          <ChevronLeft aria-hidden className="h-3.5 w-3.5" />
          {previousLabel}
        </Link>
      ) : (
        <span className="flex items-center gap-1 text-muted-foreground/50">
          <ChevronLeft aria-hidden className="h-3.5 w-3.5" />
          {previousLabel}
        </span>
      )}
      {next ? (
        <Link
          href={hrefFor(next.id)}
          className="flex items-center gap-1 font-medium text-musiva-plum hover:underline"
        >
          {nextLabel}
          <ChevronRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <span className="flex items-center gap-1 text-muted-foreground/50">
          {nextLabel}
          <ChevronRight aria-hidden className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}
