import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbSegment = {
  label: string;
  /** Omit on the current (last) page — it renders as plain text, never a link. */
  href?: string;
};

/**
 * Small uppercase trail shown above the page title (replaces the old plain "eyebrow" label
 * text with a clickable hierarchy, e.g. "Orders > MSV-10011"). The last segment is always the
 * current page and never a link, even if it has an href.
 */
export function Breadcrumb({ segments }: { segments: BreadcrumbSegment[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1 text-sm font-medium uppercase tracking-[0.22em] text-musiva-gold"
    >
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span key={`${segment.label}-${index}`} className="flex items-center gap-1">
            {index > 0 && <ChevronRight aria-hidden className="h-3 w-3 shrink-0 opacity-60" />}
            {segment.href && !isLast ? (
              <Link href={segment.href} className="transition-colors hover:text-musiva-plum">
                {segment.label}
              </Link>
            ) : (
              <span aria-current={isLast ? "page" : undefined}>{segment.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
