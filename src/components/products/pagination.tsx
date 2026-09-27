import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ELLIPSIS, getPageNumbers } from "@/lib/utils/pagination";
import { GoToPageForm } from "@/components/products/go-to-page-form";

type PaginationProps = {
  page: number;
  pageCount: number;
  href: (page: number) => string;
  /** Total row count and page size — when both are given, shows "Showing 1–10 of 48". Optional
   *  so existing callers that don't have an exact count keep working unchanged. */
  totalCount?: number;
  pageSize?: number;
};

/**
 * Deliberately NOT a client component: every caller is a Server Component page.tsx passing a
 * plain `href` function built from its own query params — functions cannot be passed to Client
 * Components, so Pagination stays server-renderable and calls `href(n)` directly to produce
 * plain-string hrefs baked into the server-rendered links. Only the "Go to page" input needs
 * interactivity, so that one piece is split out into its own client component (GoToPageForm),
 * which receives a plain serializable string instead of the function.
 */
export function Pagination({ page, pageCount, href, totalCount, pageSize }: PaginationProps) {
  if (pageCount <= 1) {
    return null;
  }

  const pageNumbers = getPageNumbers(page, pageCount);
  const showGoToPage = pageCount > 5;

  const showingRange =
    totalCount !== undefined && pageSize !== undefined
      ? (() => {
          const start = (page - 1) * pageSize + 1;
          const end = Math.min(page * pageSize, totalCount);
          return `Showing ${start}–${end} of ${totalCount}`;
        })()
      : null;

  return (
    <nav aria-label="Pagination" className="flex flex-col gap-3">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="text-sm text-muted-foreground">
          <p>
            Page {page} of {pageCount}
          </p>
          {showingRange && <p className="text-xs">{showingRange}</p>}
        </div>

        {/* Mobile: Previous / Page x of y / Next only — no numbered list, no overflow. */}
        <div className="flex items-center gap-2 sm:hidden">
          <PrevNextButton disabled={page <= 1} href={href(Math.max(1, page - 1))}>
            Previous
          </PrevNextButton>
          <span className="px-1 text-sm font-medium text-musiva-plum">
            Page {page} of {pageCount}
          </span>
          <PrevNextButton disabled={page >= pageCount} href={href(Math.min(pageCount, page + 1))}>
            Next
          </PrevNextButton>
        </div>

        {/* Desktop/tablet: Previous, page numbers, Next. */}
        <div className="hidden items-center gap-1.5 sm:flex sm:flex-wrap">
          <PrevNextButton disabled={page <= 1} href={href(Math.max(1, page - 1))}>
            Previous
          </PrevNextButton>

          {pageNumbers.map((entry, index) =>
            entry === ELLIPSIS ? (
              <span key={`ellipsis-${index}`} className="px-1.5 text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={entry}
                asChild
                size="sm"
                variant={entry === page ? "default" : "outline"}
                className={cn("min-w-9", entry === page && "pointer-events-none")}
              >
                <Link href={href(entry)} aria-current={entry === page ? "page" : undefined}>
                  {entry}
                </Link>
              </Button>
            ),
          )}

          <PrevNextButton disabled={page >= pageCount} href={href(Math.min(pageCount, page + 1))}>
            Next
          </PrevNextButton>
        </div>
      </div>

      {showGoToPage && <GoToPageForm pageCount={pageCount} sampleHref={href(1)} />}
    </nav>
  );
}

/** Previous/Next control. When `disabled`, renders a real disabled `<button>` — not a styled
 *  `<a>` that would still navigate on click, since HTML `disabled`/`:disabled` has no effect on
 *  anchor elements. */
function PrevNextButton({
  disabled,
  href,
  children,
}: {
  disabled: boolean;
  href: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <Button disabled size="sm" variant="outline" type="button">
        {children}
      </Button>
    );
  }
  return (
    <Button asChild size="sm" variant="outline">
      <Link href={href}>{children}</Link>
    </Button>
  );
}
